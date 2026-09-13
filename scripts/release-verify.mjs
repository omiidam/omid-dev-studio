#!/usr/bin/env node
/**
 * release-verify.mjs — the FAIL-CLOSED promotion gate for the release pipeline.
 *
 * A released artifact exists; that means nothing. This script decides whether it
 * may become the CURRENT release, and it only says yes on explicit proof that
 * every client keeps running the complete release it completed.
 *
 *   candidate staged (not current, not announced)
 *        ↓  stage 1 — staging must not leak to real clients
 *        ↓  stage 2 — candidate world: what WOULD be true after promotion
 *        ↓           (exercised through the router's loopback verification mode)
 *   ALL PASS?
 *     ┌──┴──┐
 *    YES    NO
 *     ↓      ↓
 *  promote  BLOCK: candidate marked blocked, `current` untouched,
 *           previous known-good release keeps serving every client
 *
 * Fail-closed rules
 * -----------------
 * Promotion requires an explicit successful result. Unknown, error, timeout,
 * missing result and "could not prove it" are all FAILURES — never passes:
 *   • router unreachable / registry unreadable → BLOCK
 *   • no candidate staged → BLOCK (nothing may be promoted)
 *   • no outdated client available to prove isolation with → BLOCK
 *   • any check failing, any infrastructure error, any timeout → BLOCK
 *
 * How isolation is actually proven (no marker-dependent shortcuts)
 * ---------------------------------------------------------------
 * Each lane serves ground truth for its own artifact (its own port, its own
 * bundle fingerprint), and the comparison is on the DOCUMENT a client receives
 * through the router: it must match that client's completed release and never
 * the candidate's. Marker attributes are checked too, but a build too old to
 * have them still has to prove isolation through its bundle, its build id, its
 * service worker and its own version-stamped cache names.
 *
 * Nothing here is mocked: the checks drive the real router, the real lanes, the
 * real /api/update/* endpoints and the real persisted store. The only synthetic
 * input is a throwaway client identity (random UUID), because state changes must
 * be real without touching a real client.
 *
 * Usage
 * -----
 *   npm run verify:release              # verify the staged candidate, do not promote
 *   npm run verify:release -- --promote  # verify, then promote atomically on success
 */

import process from "node:process";
import {
  artifactDirsFor,
  gateClientId,
  isGateClientId,
  promoteCandidate,
  readClientState,
  readRegistry,
  updateRegistry,
} from "./lib/release-registry.mjs";

const ARGS = process.argv.slice(2);
const PROMOTE = ARGS.includes("--promote");
const BASE = (
  ARGS.find((arg) => arg.startsWith("http")) ??
  process.env.OMID_STUDIO_VERIFY_BASE ??
  "http://127.0.0.1:57500"
).replace(/\/$/, "");

const results = [];
let failed = 0;
let warned = 0;
let blocker = null;
/** Whether the blocking verdict has been persisted (guards double-writes). */
let verdictRecorded = false;

function log(...parts) {
  console.log("[release-verify]", ...parts);
}

function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  if (!ok) failed += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

function warn(name, detail) {
  warned += 1;
  console.log(`  WARN  ${name}${detail ? ` — ${detail}` : ""}`);
}

/** A condition under which verification cannot proceed at all (never a pass). */
function blockBlocking(reason) {
  blocker = reason;
  failed += 1;
  console.log(`  FAIL  BLOCKED — ${reason}`);
}

async function request(pathname, { cookie, method = "GET", body, base = BASE, token } = {}) {
  const headers = { accept: "*/*" };
  if (cookie) headers.cookie = cookie;
  if (token) headers["x-omid-verify"] = token;
  if (body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(`${base}${pathname}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
    signal: AbortSignal.timeout(20_000),
  });
  return {
    status: response.status,
    release: response.headers.get("x-omid-release"),
    text: await response.text(),
  };
}

async function json(pathname, options) {
  const response = await request(pathname, options);
  try {
    return { ...response, json: JSON.parse(response.text) };
  } catch {
    return { ...response, json: null };
  }
}

const cookieFor = (clientId) => `os_update_client=${clientId}`;

function appVersionOf(html) {
  return html.match(/data-app-version="([^"]+)"/)?.[1] ?? null;
}

function staticAssets(html) {
  return new Set([...html.matchAll(/\/_next\/static\/[^"'\s\\)]+/g)].map((match) => match[0]));
}

/** Build-marker-independent identity of the release a document came from. */
function bundleFingerprint(html) {
  return [...staticAssets(html)].sort().join("\n");
}

/** The APP_VERSION a service worker was stamped with (also its cache namespace). */
function workerVersion(source) {
  return source.match(/APP_VERSION\s*=\s*"([^"]+)"/)?.[1] ?? null;
}

/** Ground truth per lane: what that artifact actually serves. */
async function laneDocument(port) {
  const response = await fetch(`http://127.0.0.1:${port}/`, {
    signal: AbortSignal.timeout(20_000),
  });
  const html = await response.text();
  return { fingerprint: bundleFingerprint(html), assets: staticAssets(html), marker: appVersionOf(html) };
}

/**
 * The completion endpoint is rate-limited per IP (20 per 10 minutes), and the
 * gate spends a few of those slots. Hitting the limit means the gate cannot
 * prove persistence in this run — report that plainly (a 429 must never be read
 * as a versioning failure) and block, because unproven is not verified.
 */
function rateLimited(response) {
  if (response.status !== 429) return false;
  blockBlocking(
    "the update endpoint rate-limited this verification run (429) — re-run once the window resets; nothing was promoted",
  );
  return true;
}

/** Wait (bounded) for the router to publish a state the gate depends on. */
async function waitFor(predicate, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await predicate().catch(() => null);
    if (value) return value;
    if (Date.now() > deadline) return null;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

async function main() {
  log(`verifying ${BASE}${PROMOTE ? " (promote on pass)" : ""}`);

  const registry = await readRegistry();
  const candidateRegistration = registry.candidate;
  if (
    !candidateRegistration ||
    typeof candidateRegistration.verifyToken !== "string" ||
    // An already-promoted candidate is the current release, not a candidate
    // awaiting a verdict. Verifying it must not "block" the live release.
    candidateRegistration.status === "promoted"
  ) {
    blockBlocking(
      "no candidate release is staged (nothing to verify, and nothing may be promoted)",
    );
    return;
  }
  const candidateVersion = candidateRegistration.version;
  const verifyToken = candidateRegistration.verifyToken;
  log(`candidate under test: ${candidateVersion} (status ${candidateRegistration.status})`);

  /* Re-testing a previously blocked candidate: clear the blocked marker BEFORE
     measuring. Otherwise the router would (rightly) refuse to serve clients the
     very artifact under test, and the gate would be measuring a different
     deployment than the one it is about to bless. `current` is untouched. */
  if (candidateRegistration.status === "blocked") {
    await updateRegistry((current) => {
      if (current.candidate?.version !== candidateVersion) return current;
      for (const release of current.releases) {
        if (release.version === candidateVersion && release.status === "blocked") {
          release.status = "candidate";
        }
      }
      return current;
    });
    log(`candidate ${candidateVersion} is being re-verified after a block`);
  }

  /* ── Stage 0 — pipeline state ──────────────────────────────────────── */
  const diagnostics = await (async () => {
    try {
      return await json("/__releases");
    } catch (error) {
      return { json: null, error };
    }
  })();
  if (!diagnostics.json) {
    blockBlocking(
      `router at ${BASE} did not answer /__releases (${
        diagnostics.error?.name === "TimeoutError" ? "timeout" : "unreachable"
      }) — verification cannot be performed, so the candidate stays un-promoted`,
    );
    return;
  }
  /* Let the router settle before measuring anything: `/__releases` triggers a
     registry reload (so a just-staged candidate, or a lane that a re-publish
     replaced, is reflected), and every lane it lists must actually answer.
     Measuring a lane set that is still converging would produce a verdict about
     a state that never existed in production. */
  const settled = await waitFor(async () => {
    const fresh = (await json("/__releases")).json;
    if (!fresh || !Array.isArray(fresh.lanes) || fresh.lanes.length === 0) return null;
    const answers = await Promise.all(
      fresh.lanes.map(async (lane) => {
        try {
          await laneDocument(lane.port);
          return true;
        } catch {
          return false;
        }
      }),
    );
    return answers.every(Boolean) ? fresh : null;
  }, 60_000);
  if (!settled) {
    blockBlocking(
      "release lanes did not become ready — isolation cannot be measured, so the candidate stays un-promoted",
    );
    return;
  }
  const diag = settled;
  const previousCurrent = diag.current;
  log(`current release: ${previousCurrent}`);
  log(`lanes: ${diag.lanes.map((lane) => `${lane.version}@${lane.port}(${lane.role})`).join(", ")}`);

  check(
    "state:candidate-not-current",
    diag.candidate?.version === candidateVersion &&
      diag.candidate?.status !== "promoted" &&
      previousCurrent !== candidateVersion,
    `current=${previousCurrent}, candidate=${diag.candidate?.version}/${diag.candidate?.status}`,
  );

  const stagedLane = await waitFor(async () => {
    const fresh = (await json("/__releases")).json;
    return fresh?.lanes?.find((lane) => lane.version === candidateVersion) ?? null;
  });
  check(
    "state:candidate-lane-ready",
    Boolean(stagedLane),
    stagedLane ? `lane ${candidateVersion} on port ${stagedLane.port}` : "candidate lane never appeared",
  );
  if (!stagedLane) return;

  const currentLane = diag.lanes.find((lane) => lane.version === previousCurrent) ?? null;
  check(
    "state:current-lane-ready",
    Boolean(currentLane),
    currentLane ? `lane ${previousCurrent} on port ${currentLane.port}` : `no lane serves current ${previousCurrent}`,
  );
  if (!currentLane) return;

  const candidateDoc = await laneDocument(stagedLane.port);
  const currentDoc = await laneDocument(currentLane.port);
  check(
    "state:artifacts-distinct",
    candidateDoc.fingerprint !== currentDoc.fingerprint,
    `candidate bundle (${candidateDoc.assets.size} assets) differs from current (${currentDoc.assets.size})`,
  );

  /* ── Pick the real clients used to prove isolation ──────────────────── */
  const clients = await readClientState();
  const byVersion = new Map();
  for (const [clientId, version] of clients) {
    // Gate identities are this script's own throwaways, never real clients.
    if (!version || isGateClientId(clientId)) continue;
    if (!byVersion.has(version)) byVersion.set(version, []);
    byVersion.get(version).push(clientId);
  }
  /* Every completed release that clients still run has to be provable. A
     release whose build was never published (it predates the artifact pipeline
     and exists in no build) has nothing to be isolated TO — those clients
     already run the current release with an update offer. That gap exists
     regardless of this candidate, so it is reported rather than hidden, and is
     never the reason a release is blocked or waved through. An artifact that
     EXISTS but has no lane is a deployment fault, and blocks. */
  const targets = [];
  for (const [version, ids] of byVersion) {
    if (version === candidateVersion) continue;
    const lane = diag.lanes.find((entry) => entry.version === version) ?? null;
    if ((await artifactDirsFor(version)).length === 0) {
      warn(
        `pre-existing:${version}`,
        `${ids.length} client(s) completed ${version}, whose build was never published — they run the current release and are offered the update (not caused by this release)`,
      );
      continue;
    }
    if (!lane) {
      blockBlocking(
        `clients still run ${version} and its artifact exists, but no lane serves it — isolation cannot be proven`,
      );
      continue;
    }
    targets.push({ version, clientId: ids[0], lane, doc: await laneDocument(lane.port) });
  }
  if (blocker) return;
  if (targets.length === 0) {
    blockBlocking(
      "no client has a published release to prove isolation with — old-client isolation cannot be demonstrated",
    );
    return;
  }
  targets.sort((a, b) =>
    a.version === previousCurrent ? -1 : b.version === previousCurrent ? 1 : 0,
  );
  const primary = targets[0];
  log(
    `isolation targets: ${targets
      .map((target) => `${target.version} (${target.clientId.slice(0, 8)}…)`)
      .join(", ")}`,
  );

  const assertTargetIsolated = async (label, target, { token } = {}) => {
    const page = await request("/", { cookie: cookieFor(target.clientId), token });
    const fingerprint = bundleFingerprint(page.text);
    const marker = appVersionOf(page.text);
    check(
      `${label}:${target.version}:runs-its-release`,
      page.release === target.version && fingerprint === target.doc.fingerprint,
      `x-omid-release=${page.release}, bundle matches ${target.version}`,
    );
    check(
      `${label}:${target.version}:no-candidate-code`,
      fingerprint !== candidateDoc.fingerprint &&
        (candidateRegistration.buildId === null ||
          !page.text.includes(candidateRegistration.buildId)) &&
        marker !== candidateVersion,
      `candidate build ${candidateRegistration.buildId} and bundle absent from the ${target.version} client`,
    );
    return page;
  };

  const sample = [...primary.doc.assets].slice(0, 6);
  const sampleStatuses = await Promise.all(
    sample.map(
      async (asset) => (await request(asset, { cookie: cookieFor(primary.clientId) })).status,
    ),
  );
  check(
    "stage1:primary-assets-served",
    sampleStatuses.length === 6 && sampleStatuses.every((status) => status === 200),
    `sampled for ${primary.version}: ${sampleStatuses.join(",")}`,
  );

  /* ── Stage 1 — staging must not leak to real clients ───────────────── */
  log("— stage 1: staging must not leak (real traffic, no verification token)");
  for (const target of targets) await assertTargetIsolated("stage1", target);

  const primaryCookie = cookieFor(primary.clientId);
  const stagedStatus = await json("/api/update/status", { cookie: primaryCookie });
  check(
    "stage1:candidate-not-announced",
    stagedStatus.release === previousCurrent &&
      stagedStatus.json?.data?.currentVersion === previousCurrent &&
      stagedStatus.json?.data?.release?.version === previousCurrent,
    `status answered by ${stagedStatus.release}, offering ${stagedStatus.json?.data?.release?.version}`,
  );
  /* Capability check, on a THROWAWAY identity only: the authoritative release
     must refuse a completion aimed at a release it does not know. Real clients
     are never posted with — if the deployment is broken (say a lane serving the
     wrong artifact), a real identity could otherwise be advanced BY the gate
     itself, which is exactly the damage the gate exists to prevent. */
  const capabilityClient = gateClientId();
  const capabilityAttempt = await json("/api/update/complete", {
    cookie: cookieFor(capabilityClient),
    method: "POST",
    body: { fromVersion: null, toVersion: candidateVersion },
  });
  if (rateLimited(capabilityAttempt)) return;
  check(
    "stage1:authority-refuses-unpromoted-completion",
    capabilityAttempt.status === 400 &&
      capabilityAttempt.json?.error?.code === "VERSION_MISMATCH" &&
      (await readClientState()).get(capabilityClient) === undefined,
    `status=${capabilityAttempt.status}, code=${capabilityAttempt.json?.error?.code}, nothing persisted`,
  );
  check(
    "stage1:old-client-version-unchanged",
    (await readClientState()).get(primary.clientId) === primary.version,
    `${primary.clientId.slice(0, 8)}… still installed=${primary.version}`,
  );

  const newClientCookie = cookieFor(gateClientId());
  const newClientPage = await request("/", { cookie: newClientCookie });
  check(
    "stage1:new-client-gets-current-release",
    newClientPage.release === previousCurrent &&
      bundleFingerprint(newClientPage.text) === currentDoc.fingerprint,
    `client with no completed version → ${newClientPage.release}`,
  );

  const worker = await request("/sw.js", { cookie: primaryCookie });
  check(
    "stage1:service-worker-isolation",
    worker.release === primary.version && workerVersion(worker.text) === primary.version,
    `sw.js from lane ${worker.release}, stamped APP_VERSION=${workerVersion(worker.text)} (cache namespace)`,
  );
  const candidateWorker = await request("/sw.js", { token: verifyToken });
  check(
    "stage1:no-candidate-worker-leak",
    workerVersion(worker.text) !== workerVersion(candidateWorker.text),
    `old worker ${workerVersion(worker.text)} ≠ candidate worker ${workerVersion(candidateWorker.text)}`,
  );

  /* ── Stage 2 — candidate world (post-promotion routing, sandboxed) ─── */
  log("— stage 2: candidate world (verification token; real clients unaffected)");
  const candidateStatus = await json("/api/update/status", {
    cookie: primaryCookie,
    token: verifyToken,
  });
  const candidateData = candidateStatus.json?.data ?? {};
  check(
    "stage2:authority-would-be-candidate",
    candidateStatus.release === candidateVersion &&
      candidateData.currentVersion === candidateVersion,
    `x-omid-release=${candidateStatus.release}, currentVersion=${candidateData.currentVersion}`,
  );
  check(
    "stage2:offers-candidate-not-activated",
    candidateData.updateRequired === true &&
      candidateData.effectiveVersion === primary.version &&
      candidateData.userCompletedVersion === primary.version,
    `updateRequired=${candidateData.updateRequired}, effectiveVersion=${candidateData.effectiveVersion} (unchanged)`,
  );
  check(
    "stage2:changelog-from-backend",
    candidateData.release?.version === candidateVersion && (candidateData.release?.changes?.length ?? 0) > 0,
    `${candidateData.release?.changes?.length ?? 0} change(s) for ${candidateData.release?.version} served by the backend, not by the ${primary.version} bundle`,
  );
  for (const change of candidateData.release?.changes ?? []) {
    log(`    changelog[${change.category}] ${change.text}`);
  }
  for (const target of targets) {
    await assertTargetIsolated("stage2", target, { token: verifyToken });
    const afterLater = await request("/", {
      cookie: cookieFor(target.clientId),
      token: verifyToken,
    });
    check(
      `stage2:${target.version}:later-changes-nothing`,
      afterLater.release === target.version &&
        bundleFingerprint(afterLater.text) === target.doc.fingerprint,
      `still served by lane ${afterLater.release} with the ${target.version} bundle`,
    );
  }

  /* A failed update must leave the client exactly as it was. The attempt uses a
     throwaway identity (see stage1:authority-refuses-unpromoted-completion);
     the real clients are asserted read-only, never written to. */
  const failedClient = gateClientId();
  const failedForOld = await json("/api/update/complete", {
    cookie: cookieFor(failedClient),
    token: verifyToken,
    method: "POST",
    body: { fromVersion: "0.0.0-nope", toVersion: candidateVersion },
  });
  const failedPage = await request("/", { cookie: cookieFor(failedClient), token: verifyToken });
  if (rateLimited(failedForOld)) return;
  check(
    "stage2:failed-update-refused",
    failedForOld.status === 409 && (await readClientState()).get(failedClient) === undefined,
    `status=${failedForOld.status}, code=${failedForOld.json?.error?.code}, nothing persisted`,
  );
  check(
    "stage2:failed-update-no-partial-activation",
    bundleFingerprint(failedPage.text) === candidateDoc.fingerprint &&
      (await readClientState()).get(failedClient) === undefined,
    "never-completed client stays uninstalled, still served the authority bundle",
  );
  const realClientsIntact = [];
  const storedNow = await readClientState();
  for (const target of targets) {
    realClientsIntact.push(storedNow.get(target.clientId) === target.version);
  }
  check(
    "stage2:real-clients-untouched",
    realClientsIntact.every(Boolean),
    targets
      .map((target, index) => `${target.version}:${realClientsIntact[index] ? "ok" : "CHANGED"}`)
      .join(", "),
  );

  const blockedClient = gateClientId();
  const blockedCookie = cookieFor(blockedClient);
  await json("/api/update/complete", {
    cookie: blockedCookie,
    token: verifyToken,
    method: "POST",
    body: { fromVersion: null, toVersion: "0.0.0-nope" },
  });
  const blockedStatus = await json("/api/update/status", { cookie: blockedCookie, token: verifyToken });
  check(
    "stage2:invalid-submission-persists-nothing",
    (await readClientState()).get(blockedClient) === undefined &&
      blockedStatus.json?.data?.effectiveVersion === null,
    "no record written, installed version still none",
  );

  const updateClient = gateClientId();
  const updateCookie = cookieFor(updateClient);
  const beforeUpdate = await json("/api/update/status", { cookie: updateCookie, token: verifyToken });
  check(
    "stage2:update-client-starts-uninstalled",
    beforeUpdate.json?.data?.updateRequired === true && beforeUpdate.json?.data?.effectiveVersion === null,
    `effectiveVersion=${beforeUpdate.json?.data?.effectiveVersion}`,
  );
  const completed = await json("/api/update/complete", {
    cookie: updateCookie,
    token: verifyToken,
    method: "POST",
    body: { fromVersion: null, toVersion: candidateVersion },
  });
  if (rateLimited(completed)) return;
  check(
    "stage2:update-persisted",
    completed.status === 200 && completed.json?.data?.effectiveVersion === candidateVersion,
    `status=${completed.status}, effectiveVersion=${completed.json?.data?.effectiveVersion}`,
  );
  check(
    "stage2:update-record-on-disk",
    (await readClientState()).get(updateClient) === candidateVersion,
    "backend store is the source of truth for the transition",
  );
  const replayed = await json("/api/update/complete", {
    cookie: updateCookie,
    token: verifyToken,
    method: "POST",
    body: { fromVersion: null, toVersion: candidateVersion },
  });
  check(
    "stage2:replay-refused",
    replayed.status === 409,
    `status=${replayed.status}, code=${replayed.json?.error?.code}`,
  );
  /* Two distinct claims. (1) In the post-promotion world this client is fully
     up to date — asked with the verification token, because before promotion
     the current release is still the previous one and would (correctly) still
     report an update against itself. (2) Independently of any token, a client
     IS served the bundle of the release it completed — the routing invariant. */
  const afterUpdate = await json("/api/update/status", {
    cookie: updateCookie,
    token: verifyToken,
  });
  check(
    "stage2:updated-client-considered-current",
    afterUpdate.json?.data?.updateRequired === false &&
      afterUpdate.json?.data?.effectiveVersion === candidateVersion,
    `updateRequired=${afterUpdate.json?.data?.updateRequired}, effectiveVersion=${afterUpdate.json?.data?.effectiveVersion}`,
  );
  /* The router caches the client store for STATE_CACHE_MS (1s). Immediately
     after the completion POST the cache may still resolve this fresh client
     to the authority lane — a timing artifact, not a routing leak. Poll past
     the cache TTL instead of racing it; failure to converge by the deadline
     is still a FAIL (timeout ≠ PASS). */
  let updatedPage = null;
  const routingDeadline = Date.now() + 6_000;
  while (Date.now() < routingDeadline) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    updatedPage = await request("/", { cookie: updateCookie });
    if (updatedPage.release === candidateVersion) break;
  }
  check(
    "stage2:updated-client-runs-completed-bundle",
    updatedPage.release === candidateVersion &&
      bundleFingerprint(updatedPage.text) === candidateDoc.fingerprint,
    `served by lane ${updatedPage.release}, bundle matches ${candidateVersion}`,
  );

  /* ── Verdict ───────────────────────────────────────────────────────── */
  const passed = results.length - failed;
  console.log("");
  console.log(
    `[release-verify] ${passed}/${results.length} checks passed for candidate ${candidateVersion}` +
      (warned ? ` (${warned} warning(s))` : ""),
  );

  if (failed > 0) {
    const reason = blocker ?? `isolation verification failed: ${results.filter((r) => !r.ok).map((r) => r.name).join(", ")}`;
    await recordVerdict(candidateVersion, "blocked", {
      reason,
      checks: results,
      previousCurrent,
    });
    console.error("");
    console.error(`[release-verify] RELEASE BLOCKED — ${reason}`);
    console.error(`[release-verify] current release remains ${previousCurrent}; ${candidateVersion} was NOT promoted`);
    process.exit(1);
  }

  await recordVerdict(candidateVersion, "verified", {
    reason: null,
    checks: results,
    previousCurrent,
  });
  log(`candidate ${candidateVersion} VERIFIED (isolation + update lifecycle)`);

  if (!PROMOTE) {
    log("no --promote flag given — the candidate stays staged and is still NOT current");
    return;
  }

  /* ── Promotion (atomic, only from the verified state) ──────────────── */
  let promotion = null;
  const promoted = await updateRegistry(async (current) => {
    promotion = await promoteCandidate(current);
    return current;
  });
  check(
    "promote:gate-accepted",
    promotion?.ok === true,
    promotion?.ok ? `${promotion.previous} → ${promotion.version}` : promotion?.reason,
  );
  if (!promotion?.ok) {
    await recordVerdict(candidateVersion, "blocked", {
      reason: `promotion refused: ${promotion?.reason}`,
      checks: results,
      previousCurrent,
    });
    process.exit(1);
  }
  log(`PROMOTED: current release is now ${promoted.current}`);

  /* ── Stage 3 — post-promotion confirmation on real traffic ─────────── */
  log("— stage 3: live confirmation after promotion (no token)");
  const liveDiag = await waitFor(async () => {
    const fresh = (await json("/__releases")).json;
    return fresh?.current === candidateVersion ? fresh : null;
  });
  check(
    "live:current-is-candidate",
    Boolean(liveDiag) && liveDiag.candidate?.status === "promoted",
    `router reports current=${liveDiag?.current ?? "?"}, candidate status=${liveDiag?.candidate?.status ?? "?"}`,
  );
  for (const target of targets) {
    await assertTargetIsolated("live", target);
    const liveStatus = await json("/api/update/status", { cookie: cookieFor(target.clientId) });
    check(
      `live:${target.version}:offered-candidate`,
      liveStatus.release === candidateVersion &&
        liveStatus.json?.data?.currentVersion === candidateVersion &&
        liveStatus.json?.data?.updateRequired === true &&
        liveStatus.json?.data?.effectiveVersion === target.version,
      `offering ${liveStatus.json?.data?.currentVersion} to a client on ${liveStatus.json?.data?.effectiveVersion}`,
    );
    const liveLater = await request("/", { cookie: cookieFor(target.clientId) });
    check(
      `live:${target.version}:later-inert`,
      liveLater.release === target.version &&
        bundleFingerprint(liveLater.text) === target.doc.fingerprint,
      `still ${target.version} after re-entry`,
    );
  }
  const liveNewClient = await request("/", { cookie: cookieFor(gateClientId()) });
  check(
    "live:new-client-gets-current",
    liveNewClient.release === candidateVersion &&
      bundleFingerprint(liveNewClient.text) === candidateDoc.fingerprint,
    `new client → ${liveNewClient.release}`,
  );
  const liveUpdateClient = gateClientId();
  await json("/api/update/complete", {
    cookie: cookieFor(liveUpdateClient),
    method: "POST",
    body: { fromVersion: null, toVersion: candidateVersion },
  });
  const liveUpdatedPage = await request("/", { cookie: cookieFor(liveUpdateClient) });
  check(
    "live:update-then-runs-new-release",
    (await readClientState()).get(liveUpdateClient) === candidateVersion &&
      bundleFingerprint(liveUpdatedPage.text) === candidateDoc.fingerprint,
    `persisted and served ${candidateVersion}`,
  );

  const postFailed = results.filter((result) => !result.ok);
  if (postFailed.length > 0) {
    // Fail closed even here: revert the authoritative release to the previous
    // known-good one rather than leave an unproven release current.
    const reverted = await updateRegistry((current) => {
      current.current = previousCurrent;
      current.candidate = {
        ...(current.candidate ?? { version: candidateVersion }),
        status: "blocked",
        blockedReason: `post-promotion verification failed: ${postFailed.map((r) => r.name).join(", ")}`,
      };
      for (const release of current.releases) {
        if (release.version === previousCurrent) release.status = "current";
        if (release.version === candidateVersion) release.status = "blocked";
      }
      return current;
    });
    console.error("");
    console.error(
      `[release-verify] POST-PROMOTION VERIFICATION FAILED — reverted current to ${reverted.current}`,
    );
    process.exit(1);
  }

  console.log("");
  console.log(`[release-verify] ${results.length}/${results.length} checks passed`);
  console.log(`[release-verify] RELEASED: ${promotion.previous} → ${promotion.version} is now current`);
}

/** Persist the verification verdict (never the promotion itself) into the registry. */
async function recordVerdict(candidateVersion, status, { reason, checks, previousCurrent }) {
  verdictRecorded = true;
  await updateRegistry((registry) => {
    if (!registry.candidate || registry.candidate.version !== candidateVersion) return registry;
    const summary = {
      checkedAt: new Date().toISOString(),
      passed: checks.filter((check) => check.ok).length,
      failed: checks.filter((check) => !check.ok).length,
      warned,
      previousCurrent: previousCurrent ?? null,
      checks: checks.map((check) => `${check.ok ? "PASS" : "FAIL"} ${check.name}`),
    };
    registry.candidate = {
      ...registry.candidate,
      status,
      blockedReason: status === "blocked" ? reason : null,
      verification: summary,
      // Keep every verdict: a gate that overwrites its own history cannot be
      // audited afterwards.
      verificationHistory: [...(registry.candidate.verificationHistory ?? []), summary].slice(-20),
    };
    /* The release entry status drives routing for clients that completed that
       version. A failed verdict marks it blocked (so any such client is moved
       back to the current release rather than pinned to a release that never
       became authoritative); re-verifying after a fix clears that, because the
       candidate is once again a legitimate thing to be running — still NOT
       current, which only promotion may change. */
    for (const release of registry.releases) {
      if (release.version !== candidateVersion) continue;
      release.status = status === "blocked" ? "blocked" : "candidate";
    }
    return registry;
  });
}

/** Persist (once) the blocked verdict for an aborted verification run. */
async function recordBlockedAbort(reason) {
  if (verdictRecorded) return;
  const registry = await readRegistry();
  // Never write a verdict for a release that is already current: there was
  // nothing pending to block.
  if (!registry.candidate || registry.candidate.status === "promoted") return;
  await recordVerdict(registry.candidate.version, "blocked", {
    reason,
    checks: results,
    previousCurrent: registry.current,
  });
}

main()
  .then(async () => {
    if (failed === 0) return;
    // A blocking condition may have aborted the run before the verdict section.
    const reason = blocker ?? `isolation verification failed: ${results.filter((r) => !r.ok).map((r) => r.name).join(", ")}`;
    await recordBlockedAbort(reason).catch(() => undefined);
    const registry = await readRegistry().catch(() => null);
    console.error("");
    console.error(`[release-verify] RELEASE BLOCKED — ${reason}`);
    console.error(
      `[release-verify] current release remains ${registry?.current ?? "unchanged"}; nothing was promoted`,
    );
    process.exit(1);
  })
  .catch(async (error) => {
    // Verification could not be completed → the candidate must NOT be promoted.
    console.error("[release-verify] verification error:", error?.message ?? error);
    try {
      await recordBlockedAbort(`verification aborted: ${error?.message ?? error}`);
      const registry = await readRegistry();
      console.error(
        `[release-verify] RELEASE BLOCKED — verification could not be completed; current remains ${registry.current}`,
      );
    } catch {
      console.error("[release-verify] could not record the blocked verdict — treat as BLOCKED");
    }
    process.exit(1);
  });
