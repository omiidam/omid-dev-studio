/**
 * release-registry.mjs — shared release-state primitives for the release pipeline.
 *
 * The release state keeps these concepts STRICTLY separate (never collapsed):
 *
 *   current    — currentReleaseVersion: the authoritative release clients are
 *                entitled to. Only a verified candidate may become current.
 *   candidate  — candidateVersion + releaseStatus ("candidate" | "verified" |
 *                "blocked" | "promoted") + the isolationVerificationStatus and
 *                its evidence. A staged candidate is NOT current and is not
 *                announced to clients.
 *   releases[] — every published artifact (version, buildId, dir, port, status).
 *
 * installedVersion / effectiveVersion are NOT here: they live per client in
 * `.data/update-state.json` and are written only by /api/update/complete.
 *
 * Writes are temp-file + rename (atomic) and serialized by an advisory lock, so
 * a promotion can never be observed half-applied and two pipeline steps cannot
 * interleave a read-modify-write.
 *
 * Promotions happen ONLY through promoteCandidate(), which requires an explicit
 * successful verification result for the exact artifact being promoted. There
 * is no path from the frontend — or from publishing an artifact — to "current".
 */

import { readFile, rename, stat, unlink, writeFile, mkdir, readdir } from "node:fs/promises";
import { open } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import process from "node:process";

export const ROOT = process.cwd();
export const RELEASES_ROOT = path.join(ROOT, ".releases");
export const REGISTRY_FILE =
  process.env.OMID_STUDIO_RELEASES_FILE ?? path.join(ROOT, ".data", "releases.json");
export const UPDATE_STATE_FILE =
  process.env.OMID_STUDIO_UPDATE_STATE_FILE ?? path.join(ROOT, ".data", "update-state.json");

const LOCK_FILE = `${REGISTRY_FILE}.lock`;
const LOCK_STALE_MS = 30_000;

export async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

export async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

/** Numeric semver compare (no dependency on a semver package). */
export function compareVersions(a, b) {
  const pa = String(a).split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = String(b).split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Canonical APP_VERSION from the source tree (single source of truth). */
export async function readVersionFromSource(dir = ROOT) {
  const source = await readFile(path.join(dir, "src", "config", "version.ts"), "utf8");
  return source.match(/export const APP_VERSION = "([^"]+)"/)?.[1] ?? null;
}

/** The build an artifact on disk actually contains (null when unavailable). */
export async function readArtifactBuildId(dir) {
  try {
    return (await readFile(path.join(dir, ".next", "BUILD_ID"), "utf8")).trim();
  } catch {
    return null;
  }
}

/** Absolute directory of a release artifact (registry paths use forward slashes). */
export function releaseDir(entry) {
  const raw = String(entry?.dir ?? `.releases/${entry?.version ?? ""}`);
  if (path.isAbsolute(raw)) return path.normalize(raw);
  return path.join(ROOT, ...raw.replace(/^.[/\\]/, "").split(/[/\\]+/));
}

/** Every artifact directory belonging to one version (a re-publish adds `+buildId`). */
export async function artifactDirsFor(version) {
  let entries = [];
  try {
    entries = await readdir(RELEASES_ROOT);
  } catch {
    return [];
  }
  return entries
    .filter((name) => name === version || name.startsWith(`${version}+`))
    .map((name) => path.join(RELEASES_ROOT, name));
}

/**
 * Reserved identity namespace for the promotion gate's throwaway clients.
 *
 * The gate has to perform real completions to prove persistence, but it must
 * never behave like a user: its identities are recognisable by prefix, are
 * excluded from retention decisions (a test run must not pin a release
 * forever) and are excluded from the clients the gate treats as real.
 */
export const GATE_CLIENT_PREFIX = "00000000-0000-4000-8000-";

export function isGateClientId(clientId) {
  return typeof clientId === "string" && clientId.startsWith(GATE_CLIENT_PREFIX);
}

/** A fresh, format-valid gate identity (the backend validates UUID shape). */
export function gateClientId() {
  const hex = randomBytes(6).toString("hex");
  return `${GATE_CLIENT_PREFIX}${hex}`;
}

/** Versions that REAL clients still have as their completed version. */
export async function readClientVersions() {
  const state = await readJson(UPDATE_STATE_FILE, { clients: [] });
  const versions = new Set();
  if (Array.isArray(state?.clients)) {
    for (const client of state.clients) {
      if (isGateClientId(client?.clientId)) continue;
      if (typeof client?.completedVersion === "string" && client.completedVersion) {
        versions.add(client.completedVersion);
      }
    }
  }
  return versions;
}

/** Per-client installed versions (clientId → completedVersion). */
export async function readClientState() {
  const state = await readJson(UPDATE_STATE_FILE, { clients: [] });
  const clients = new Map();
  for (const entry of Array.isArray(state?.clients) ? state.clients : []) {
    if (typeof entry?.clientId === "string") {
      clients.set(entry.clientId, entry.completedVersion ?? null);
    }
  }
  return clients;
}

/* ── Registry ─────────────────────────────────────────────────────────── */

/**
 * Normalize a registry file, tolerating the pre-gate shape (which had only
 * `latest` and no candidate — that file's `latest` IS the current release, so
 * the next publish stages a candidate against it).
 */
export function normalizeRegistry(raw) {
  const releases = (Array.isArray(raw?.releases) ? raw.releases : []).filter(
    (entry) => typeof entry?.version === "string",
  );
  const current =
    typeof raw?.current === "string"
      ? raw.current
      : typeof raw?.latest === "string"
        ? raw.latest
        : (releases[0]?.version ?? null);
  const candidate =
    raw?.candidate && typeof raw.candidate?.version === "string" ? raw.candidate : null;
  return {
    current,
    candidate,
    // `latest` is kept in sync with `current` purely for backward compatibility
    // with tooling that predates the promotion gate. It is never authoritative.
    latest: current,
    releases,
    updatedAt: typeof raw?.updatedAt === "string" ? raw.updatedAt : null,
  };
}

export function releaseEntry(registry, version) {
  return registry.releases.find((entry) => entry.version === version) ?? null;
}

export function releaseStatus(registry, version) {
  return releaseEntry(registry, version)?.status ?? null;
}

export async function readRegistry() {
  return normalizeRegistry(await readJson(REGISTRY_FILE, null));
}

export async function writeRegistry(registry) {
  await mkdir(path.dirname(REGISTRY_FILE), { recursive: true });
  const next = { ...registry, updatedAt: new Date().toISOString() };
  next.latest = next.current; // legacy mirror, never authoritative
  const tmp = `${REGISTRY_FILE}.${process.pid}.tmp`;
  await writeFile(tmp, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  await rename(tmp, REGISTRY_FILE);
  return next;
}

/** Advisory lock so two pipeline steps cannot interleave a read-modify-write. */
async function acquireLock() {
  const deadline = Date.now() + 15_000;
  for (;;) {
    try {
      const handle = await open(LOCK_FILE, "wx");
      await handle.close();
      return async () => {
        await unlink(LOCK_FILE).catch(() => undefined);
      };
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      try {
        const info = await stat(LOCK_FILE);
        if (Date.now() - info.mtimeMs > LOCK_STALE_MS) {
          await unlink(LOCK_FILE).catch(() => undefined);
          continue;
        }
      } catch {
        continue;
      }
      if (Date.now() > deadline) {
        throw new Error(`registry lock ${LOCK_FILE} is held by another pipeline step`);
      }
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  }
}

/** Read-modify-write the registry under the lock. */
export async function updateRegistry(mutate) {
  const unlock = await acquireLock();
  try {
    const registry = await readRegistry();
    const replacement = await mutate(registry);
    return await writeRegistry(replacement ?? registry);
  } finally {
    await unlock();
  }
}

export function generateVerifyToken() {
  return randomBytes(24).toString("hex");
}



/* ── Promotion gate ───────────────────────────────────────────────────── */

/**
 * The ONE way a release becomes current.
 *
 * Requires, for the exact candidate:
 *   • releaseStatus === "verified";
 *   • an explicit successful verification record (checks failed === 0);
 *   • the artifact's buildId on disk still equal to the verified buildId —
 *     a re-published or replaced artifact invalidates the verification.
 *
 * Mutates `registry` in place and returns a result; the caller persists it.
 */
export async function promoteCandidate(registry) {
  const candidate = registry.candidate;
  if (!candidate) {
    return { ok: false, reason: "no candidate release is staged" };
  }
  const verification = candidate.verification;
  if (candidate.status !== "verified") {
    return {
      ok: false,
      reason: `candidate ${candidate.version} status is "${candidate.status ?? "unknown"}", not "verified"`,
    };
  }
  if (!verification || typeof verification.checkedAt !== "string" || verification.failed !== 0) {
    return {
      ok: false,
      reason: `candidate ${candidate.version} has no successful verification result`,
    };
  }

  const entry = releaseEntry(registry, candidate.version);
  if (!entry) {
    return { ok: false, reason: `candidate ${candidate.version} has no release entry` };
  }
  const artifactBuildId = await readArtifactBuildId(releaseDir(entry));
  if (!artifactBuildId) {
    return { ok: false, reason: `candidate ${candidate.version} artifact is missing on disk` };
  }
  if (artifactBuildId !== candidate.buildId) {
    return {
      ok: false,
      reason: `candidate artifact was replaced after verification (verified ${candidate.buildId}, on disk ${artifactBuildId})`,
    };
  }

  const previous = registry.current;
  registry.current = candidate.version;
  registry.candidate = {
    ...candidate,
    status: "promoted",
    promotedAt: new Date().toISOString(),
    previousCurrent: previous ?? null,
  };
  for (const release of registry.releases) {
    if (release.version === candidate.version) release.status = "current";
    else if (release.version === previous && release.status === "current") release.status = "previous";
  }
  return { ok: true, version: candidate.version, previous };
}
