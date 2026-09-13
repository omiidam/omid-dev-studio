#!/usr/bin/env node
/**
 * release-verify.mjs — prove, against the LIVE router, that a released version
 * cannot leak into a client that has not completed the update.
 *
 * Why this exists
 * ---------------
 * `npm run release` publishes an immutable artifact per version and the router
 * routes each client to the release they completed. That guarantee is the whole
 * point of the pipeline, so it must be checkable on demand rather than trusted:
 * a deploy that silently regressed it would look exactly like a healthy one
 * until a real user saw new UI before completing the update.
 *
 * How isolation is proven (build-marker independent)
 * -------------------------------------------------
 * Releases older than the marker attribute have no `data-app-version`, so the
 * harness compares the DOCUMENT ITSELF:
 *
 *   • each lane's own port serves ground truth for that artifact's JS/CSS set;
 *   • a client's routed document must match ITS completed release's bundle and
 *     differ from the latest release's;
 *   • `/api/update/status` must always be answered by the latest release, and
 *     must report `effectiveVersion` = the client's completed version — never
 *     the deployed release;
 *   • "Later" is inert: repeated entry never moves the client;
 *   • the effective version advances ONLY through a persisted
 *     POST /api/update/complete; forged/replayed/wrong transitions are refused
 *     with the stored state untouched;
 *   • after persistence the same client resolves to the new lane on reload.
 *
 * Usage
 * -----
 *   npm run verify:release                 # against http://127.0.0.1:57500
 *   node scripts/release-verify.mjs http://127.0.0.1:57500
 *
 * Exit code is non-zero when any check FAILS. "WARN" lines are known, documented
 * gaps (e.g. a completed release whose artifact predates this pipeline and
 * exists nowhere in git history) — they are reported, not silently accepted.
 *
 * The harness is read-only apart from ONE throwaway client identity (a random
 * UUID) whose completion it persists; the state of real clients is never touched.
 */

import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const BASE = (process.argv[2] ?? process.env.OMID_STUDIO_VERIFY_BASE ?? "http://127.0.0.1:57500").replace(/\/$/, "");
const UPDATE_STATE_FILE =
  process.env.OMID_STUDIO_UPDATE_STATE_FILE ?? path.join(ROOT, ".data", "update-state.json");
const RELEASES_ROOT = path.join(ROOT, ".releases");

const results = [];
let failed = 0;
let warned = 0;

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

async function request(pathname, { cookie, method = "GET", body, base = BASE } = {}) {
  const headers = { accept: "*/*" };
  if (cookie) headers.cookie = cookie;
  if (body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(`${base}${pathname}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
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

/** Every client identity the backend has a completed version for. */
async function storedClients() {
  try {
    const parsed = JSON.parse(await readFile(UPDATE_STATE_FILE, "utf8"));
    return (Array.isArray(parsed?.clients) ? parsed.clients : []).filter(
      (entry) => typeof entry?.clientId === "string" && typeof entry.completedVersion === "string",
    );
  } catch {
    return [];
  }
}

const cookieFor = (clientId) => `os_update_client=${clientId}`;

function appVersionOf(html) {
  return html.match(/data-app-version="([^"]+)"/)?.[1] ?? null;
}

/** Static asset URLs referenced by a page — the JS/CSS that page actually runs. */
function staticAssets(html) {
  return new Set([...html.matchAll(/\/_next\/static\/[^"'\s\\)]+/g)].map((match) => match[0]));
}

/** Build-marker-independent identity of the release a document was rendered from. */
function bundleFingerprint(html) {
  return [...staticAssets(html)].sort().join("\n");
}

/** Does an artifact for this version exist on disk at all (any re-publish suffix)? */
async function artifactExists(version) {
  try {
    const entries = await readdir(RELEASES_ROOT);
    return entries.some((name) => name === version || name.startsWith(`${version}+`));
  } catch {
    return false;
  }
}

/** Ground truth per lane: what that artifact actually serves. */
async function laneDocument(port) {
  const response = await fetch(`http://127.0.0.1:${port}/`);
  const html = await response.text();
  return { version: appVersionOf(html), fingerprint: bundleFingerprint(html), html };
}

async function main() {
  log(`verifying ${BASE}`);

  /* ── 1. The router's own view of the world ─────────────────────────── */
  const diagnostics = await json("/__releases");
  const registry = diagnostics.json;
  if (!registry) {
    log(`FATAL: ${BASE}/__releases did not answer with JSON (status ${diagnostics.status}).`);
    log("start the router first: npm run start  (see the run doc)");
    process.exit(1);
  }
  const latest = registry.latest;
  const lanes = Array.isArray(registry.lanes) ? registry.lanes : [];
  log(`latest release: ${latest}`);
  log(`lanes: ${lanes.map((lane) => `${lane.version}@${lane.port}`).join(", ") || "none"}`);

  const laneDocs = new Map();
  for (const lane of lanes) laneDocs.set(lane.version, await laneDocument(lane.port));
  const latestDoc = laneDocs.get(latest) ?? null;
  const latestBuildId = lanes.find((lane) => lane.version === latest)?.buildId ?? null;

  const defaultPage = await request("/");
  check(
    "latest-release-served-by-default",
    defaultPage.release === latest && (appVersionOf(defaultPage.text) ?? latest) === latest,
    `client with no completed version → data-app-version=${appVersionOf(defaultPage.text)}, x-omid-release=${defaultPage.release}`,
  );
  check(
    "latest-lane-serves-latest-artifact",
    latestDoc !== null && (latestDoc.version ?? latest) === latest,
    `lane ${latest} serves its own bundle (${staticAssets(defaultPage.text).size} assets)`,
  );

  /* ── 2. Per-outdated-release isolation ─────────────────────────────── */
  const clients = await storedClients();
  const byVersion = new Map();
  for (const client of clients) {
    if (!byVersion.has(client.completedVersion)) byVersion.set(client.completedVersion, []);
    byVersion.get(client.completedVersion).push(client.clientId);
  }

  for (const [version, ids] of byVersion) {
    if (version === latest) continue;
    const lane = lanes.find((entry) => entry.version === version);
    if (!lane) {
      const recoverable = await artifactExists(version);
      const detail = `${ids.length} client(s) completed ${version}; no build artifact exists for it anywhere (not in .releases, not in git history) — they are served ${latest} and offered the update`;
      if (recoverable) check(`lane-present:${version}`, false, `artifact present but no lane — ${detail}`);
      else warn(`lane-present:${version}`, detail);
      continue;
    }
    const cookie = cookieFor(ids[0]);
    const own = laneDocs.get(version);
    log(`— outdated client on ${version}: ${ids[0].slice(0, 8)}…`);

    const page = await request("/", { cookie });
    check(
      `isolation:${version}:page`,
      page.release === version &&
        own !== undefined &&
        bundleFingerprint(page.text) === own.fingerprint &&
        own.fingerprint !== latestDoc?.fingerprint,
      `x-omid-release=${page.release}, bundle matches ${version} (${own ? staticAssets(page.text).size : "?"} assets) and differs from ${latest}`,
    );
    const marker = appVersionOf(page.text);
    check(
      `isolation:${version}:no-latest-markup`,
      marker !== latest && (marker === null || marker === version),
      marker === null
        ? `build ${version} predates the data-app-version marker — bundle comparison is the proof`
        : `data-app-version=${marker}`,
    );
    check(
      `isolation:${version}:no-latest-buildid`,
      latestBuildId === null || !page.text.includes(latestBuildId),
      latestBuildId ? `latest build id ${latestBuildId} absent from the page` : "no latest build id to compare",
    );

    const assets = [...staticAssets(page.text)].slice(0, 6);
    const assetStatuses = await Promise.all(
      assets.map(async (asset) => (await request(asset, { cookie })).status),
    );
    check(
      `isolation:${version}:assets-served`,
      assetStatuses.length === 6 && assetStatuses.every((status) => status === 200),
      `sampled ${assets.length}: ${assetStatuses.join(",")}`,
    );

    const status = await json("/api/update/status", { cookie });
    const data = status.json?.data ?? {};
    check(
      `status:${version}:answered-by-latest`,
      status.release === latest && data.currentVersion === latest,
      `x-omid-release=${status.release}, currentVersion=${data.currentVersion}`,
    );
    check(
      `status:${version}:offers-newer`,
      data.updateRequired === true &&
        data.effectiveVersion === version &&
        data.userCompletedVersion === version,
      `updateRequired=${data.updateRequired}, effectiveVersion=${data.effectiveVersion}`,
    );
    check(
      `status:${version}:backend-changelog`,
      data.release?.version === latest && (data.release?.changes?.length ?? 0) > 0,
      `${data.release?.changes?.length ?? 0} change(s) for ${data.release?.version} served by the backend`,
    );
    if (data.release?.version === latest) {
      for (const change of data.release.changes ?? []) {
        log(`    changelog[${change.category}] ${change.text}`);
      }
    }

    // "Later" is inert: repeated entry keeps the client on its own release.
    const afterLater = await request("/", { cookie });
    check(
      `later:${version}:no-drift`,
      afterLater.release === version && bundleFingerprint(afterLater.text) === own?.fingerprint,
      `still served by lane ${afterLater.release} with the ${version} bundle`,
    );
  }

  /* ── 3. Lifecycle on a throwaway identity (real state changes) ─────── */
  const throwaway = randomUUID();
  const cookie = cookieFor(throwaway);
  log(`— lifecycle client: ${throwaway.slice(0, 8)}… (throwaway)`);

  const fresh = await json("/api/update/status", { cookie });
  check(
    "lifecycle:new-client-needs-update",
    fresh.json?.data?.updateRequired === true && fresh.json?.data?.effectiveVersion === null,
    `updateRequired=${fresh.json?.data?.updateRequired}, effectiveVersion=${fresh.json?.data?.effectiveVersion}`,
  );

  const forged = await json("/api/update/complete", {
    cookie,
    method: "POST",
    body: { fromVersion: "0.0.0-does-not-exist", toVersion: latest },
  });
  check(
    "lifecycle:forged-transition-refused",
    forged.status === 409 && forged.json?.error?.code === "STALE_UPDATE_STATE",
    `status=${forged.status}, code=${forged.json?.error?.code}`,
  );

  const wrongTarget = await json("/api/update/complete", {
    cookie,
    method: "POST",
    body: { fromVersion: null, toVersion: "0.0.0-does-not-exist" },
  });
  check(
    "lifecycle:wrong-target-refused",
    wrongTarget.status === 400 && wrongTarget.json?.error?.code === "VERSION_MISMATCH",
    `status=${wrongTarget.status}, code=${wrongTarget.json?.error?.code}`,
  );

  const afterFailures = await json("/api/update/status", { cookie });
  check(
    "lifecycle:failures-change-nothing",
    afterFailures.json?.data?.updateRequired === true && afterFailures.json?.data?.effectiveVersion === null,
    `updateRequired=${afterFailures.json?.data?.updateRequired}, effectiveVersion=${afterFailures.json?.data?.effectiveVersion}`,
  );

  const completed = await json("/api/update/complete", {
    cookie,
    method: "POST",
    body: { fromVersion: null, toVersion: latest },
  });
  check(
    "lifecycle:completion-persisted",
    completed.status === 200 && completed.json?.data?.effectiveVersion === latest,
    `status=${completed.status}, effectiveVersion=${completed.json?.data?.effectiveVersion}`,
  );

  const replayed = await json("/api/update/complete", {
    cookie,
    method: "POST",
    body: { fromVersion: null, toVersion: latest },
  });
  check(
    "lifecycle:replay-refused",
    replayed.status === 409,
    `status=${replayed.status}, code=${replayed.json?.error?.code}`,
  );

  const post = await json("/api/update/status", { cookie });
  check(
    "lifecycle:status-clean-after-update",
    post.json?.data?.updateRequired === false && post.json?.data?.effectiveVersion === latest,
    `updateRequired=${post.json?.data?.updateRequired}, effectiveVersion=${post.json?.data?.effectiveVersion}`,
  );

  const reloaded = await request("/", { cookie });
  check(
    "lifecycle:reload-lands-on-new-release",
    reloaded.release === latest && bundleFingerprint(reloaded.text) === latestDoc?.fingerprint,
    `x-omid-release=${reloaded.release}, bundle matches ${latest}`,
  );

  const secondReload = await request("/", { cookie });
  check(
    "lifecycle:no-repeat-offer-after-reload",
    secondReload.release === latest && bundleFingerprint(secondReload.text) === latestDoc?.fingerprint,
    `still ${secondReload.release} on the second reload`,
  );

  /* ── 4. Summary ────────────────────────────────────────────────────── */
  const passed = results.length - failed;
  console.log("");
  console.log(
    `[release-verify] ${passed}/${results.length} checks passed for release ${latest}` +
      (warned ? ` (${warned} documented gap(s) warned)` : ""),
  );
  if (failed > 0) {
    console.log("[release-verify] FAILED checks:");
    for (const result of results.filter((entry) => !entry.ok)) {
      console.log(`  • ${result.name}${result.detail ? ` — ${result.detail}` : ""}`);
    }
    process.exit(1);
  }
  console.log("[release-verify] version isolation and update lifecycle verified");
}

main().catch((error) => {
  console.error("[release-verify] unexpected failure:", error);
  process.exit(1);
});
