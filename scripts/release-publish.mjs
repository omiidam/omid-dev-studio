/**
 * release-publish.mjs — publish the current build as an immutable release.
 *
 * Why this exists
 * ---------------
 * A single mutable build directory cannot honour the version invariant. The
 * instant a new release is deployed into it, *every* client — including
 * clients that have not completed the update — is served the new UI, new
 * assets and new client behaviour. Version gating has to happen at the
 * ARTIFACT level, not at the label level:
 *
 *     .releases/<version>/   ← immutable build of exactly one release
 *
 * `scripts/release-server.mjs` (the version router) then serves each client
 * the artifact matching their backend-authoritative effective version, so an
 * outdated client literally keeps running and loading their completed
 * release until their update has been persisted.
 *
 * What it does
 * ------------
 *   1. Reads APP_VERSION (single source of truth: src/config/version.ts).
 *   2. Copies the production artifacts into `.releases/<version>/`.
 *   3. Updates the registry (`.data/releases.json`) — version → dir/port.
 *   4. Prunes older releases — but NEVER the latest, and never a release that
 *      a client still has as their completed version (pruning one would force
 *      that client onto a different build, i.e. exactly the mixing we forbid).
 *
 * Usage: `npm run release` (= npm run build && node scripts/release-publish.mjs)
 *
 * Backfilling a historical release (one that shipped before this pipeline
 * existed) is the same operation against another build directory:
 *
 *   OMID_STUDIO_PUBLISH_FROM=<dir> OMID_STUDIO_PUBLISH_VERSION=<version> \
 *     node scripts/release-publish.mjs
 */

import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const RELEASES_ROOT = path.join(ROOT, ".releases");
const REGISTRY_FILE =
  process.env.OMID_STUDIO_RELEASES_FILE ??
  path.join(ROOT, ".data", "releases.json");
const UPDATE_STATE_FILE =
  process.env.OMID_STUDIO_UPDATE_STATE_FILE ??
  path.join(ROOT, ".data", "update-state.json");

/** Exactly what a `next start` process needs to serve one immutable release. */
const ARTIFACTS = ["package.json", "next.config.ts", "public", ".next"];

/** First internal port handed to a release lane (the public port is 57500). */
const BASE_PORT = Number(process.env.OMID_STUDIO_RELEASE_BASE_PORT ?? 57510);
/** How many releases to retain once nothing references them any more. */
const KEEP = Number(process.env.OMID_STUDIO_RELEASES_KEEP ?? 4);

function log(...parts) {
  console.log("[release-publish]", ...parts);
}

function fail(message) {
  console.error("[release-publish] ERROR:", message);
  process.exit(1);
}

async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

async function readVersion(dir) {
  const source = await readFile(path.join(dir, "src", "config", "version.ts"), "utf8");
  const match = source.match(/export const APP_VERSION = "([^"]+)"/);
  if (!match) fail("could not parse APP_VERSION from src/config/version.ts");
  return match[1];
}

/** Numeric semver compare (no dependency on a semver package). */
function compareVersions(a, b) {
  const pa = String(a).split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = String(b).split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

/** Versions that clients still have as their completed version. */
async function readClientVersions() {
  const state = await readJson(UPDATE_STATE_FILE, { clients: [] });
  const versions = new Set();
  if (Array.isArray(state?.clients)) {
    for (const client of state.clients) {
      if (typeof client?.completedVersion === "string" && client.completedVersion) {
        versions.add(client.completedVersion);
      }
    }
  }
  return versions;
}

async function main() {
  // Normally the project's own build; a historical release can be backfilled
  // from any build directory via the two environment overrides.
  const fromDir = process.env.OMID_STUDIO_PUBLISH_FROM
    ? path.resolve(ROOT, process.env.OMID_STUDIO_PUBLISH_FROM)
    : ROOT;
  const version =
    process.env.OMID_STUDIO_PUBLISH_VERSION ?? (await readVersion(fromDir));
  const buildIdFile = path.join(fromDir, ".next", "BUILD_ID");
  if (!(await exists(buildIdFile))) {
    fail(`no .next/BUILD_ID in ${path.relative(ROOT, fromDir) || "."} — build it first.`);
  }
  const buildId = (await readFile(buildIdFile, "utf8")).trim();

  /* The directory name is the version. When a lane is already serving that
     version its directory is its working directory and cannot be replaced on
     Windows (EBUSY), so the re-published build gets its own directory — the
     registry is what decides which artifact a version resolves to. */
  let releaseDir = path.join(RELEASES_ROOT, version);
  if (await exists(releaseDir)) {
    await rm(releaseDir, { recursive: true, force: true }).catch(() => undefined);
    if (await exists(releaseDir)) {
      releaseDir = path.join(RELEASES_ROOT, `${version}+${buildId}`);
      log(`release ${version} is currently being served — publishing this build to ${path.basename(releaseDir)}`);
    }
  }
  await rm(releaseDir, { recursive: true, force: true }).catch(() => undefined);
  await mkdir(releaseDir, { recursive: true });
  for (const artifact of ARTIFACTS) {
    const source = path.join(fromDir, artifact);
    if (!(await exists(source))) continue;
    await cp(source, path.join(releaseDir, artifact), { recursive: true });
  }
  await writeFile(
    path.join(releaseDir, "RELEASE.json"),
    `${JSON.stringify({ version, buildId, publishedAt: new Date().toISOString() }, null, 2)}\n`,
    "utf8",
  );
  log(`published ${version} (build ${buildId}) → ${path.relative(ROOT, releaseDir)}`);

  /* ── Registry: newest first, deterministic ports, safe pruning ────────── */
  const registry = await readJson(REGISTRY_FILE, { releases: [] });
  const entries = new Map();
  for (const entry of Array.isArray(registry?.releases) ? registry.releases : []) {
    if (entry && typeof entry.version === "string") entries.set(entry.version, entry);
  }
  entries.set(version, {
    version,
    buildId,
    publishedAt: new Date().toISOString(),
  });

  let ordered = [...entries.values()].sort((a, b) =>
    compareVersions(b.version, a.version),
  );

  const clientVersions = await readClientVersions();
  const keep = new Set([version, ...clientVersions]);
  const retained = [];
  for (const entry of ordered) {
    if (keep.has(entry.version) || retained.length < KEEP) {
      retained.push(entry);
      continue;
    }
    // Old release nothing references any more — drop its artifacts (not the
    // release record, so we can still see what shipped) and free its port.
    // A directory still held open by a running lane is skipped, never fought.
    for (const dir of await artifactDirsFor(entry.version)) {
      const removed = await rm(dir, { recursive: true, force: true }).then(
        () => true,
        () => false,
      );
      if (removed) log(`pruned unreferenced release ${path.basename(dir)}`);
    }
  }
  ordered = retained;

  const ports = await readRegistryPorts(REGISTRY_FILE);
  const used = new Set();
  // Registry paths use forward slashes so they stay portable across platforms.
  const publishedDir = `./.releases/${path.basename(releaseDir)}`;
  ordered = ordered.map((entry, index) => {
    const preferred = ports.get(entry.version) ?? BASE_PORT + index;
    let port = preferred;
    while (used.has(port)) port += 1;
    used.add(port);
    return {
      ...entry,
      dir: entry.version === version ? publishedDir : (entry.dir ?? `./.releases/${entry.version}`),
      port,
    };
  });

  await mkdir(path.dirname(REGISTRY_FILE), { recursive: true });
  await writeFile(
    REGISTRY_FILE,
    `${JSON.stringify(
      {
        latest: ordered[0]?.version ?? version,
        updatedAt: new Date().toISOString(),
        releases: ordered,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  log(`registry updated → latest=${ordered[0]?.version ?? version}, ${ordered.length} lane(s)`);
  for (const entry of ordered) {
    log(`  ${entry.version}  port ${entry.port}  ${entry.dir}`);
  }
}

/** Every artifact directory belonging to one version (a re-publish adds a `+buildId` suffix). */
async function artifactDirsFor(version) {
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

/** Existing ports are reused when still free, so lanes stay stable across publishes. */
async function readRegistryPorts(file) {
  const registry = await readJson(file, { releases: [] });
  const ports = new Map();
  for (const entry of Array.isArray(registry?.releases) ? registry.releases : []) {
    if (entry && typeof entry.version === "string" && Number.isInteger(entry.port)) {
      ports.set(entry.version, entry.port);
    }
  }
  return ports;
}

main().catch((error) => {
  console.error("[release-publish] unexpected failure:", error);
  process.exit(1);
});
