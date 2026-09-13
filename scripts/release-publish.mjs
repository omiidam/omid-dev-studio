#!/usr/bin/env node
/**
 * release-publish.mjs — publish the current build as an immutable release
 * ARTIFACT and stage it as a CANDIDATE. It never promotes.
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
 * outdated client literally keeps running and loading their completed release
 * until their update has been persisted.
 *
 * Publishing ≠ releasing
 * ----------------------
 * This script only STAGES: the new artifact is registered with
 * releaseStatus "candidate" and `current` is left untouched. A candidate
 * becomes current only through the promotion gate
 * (`scripts/release-verify.mjs --promote` → promoteCandidate()), which demands
 * an explicit successful isolation verification of this exact build. If
 * verification fails, is unavailable or times out, the candidate is marked
 * BLOCKED and the previous current release keeps serving clients.
 *
 * Bootstrapping: when the registry has no current release at all (a fresh
 * install, or a registry written before the gate existed) there is nothing to
 * protect clients from, so the published release becomes current immediately
 * and is logged loudly as a bootstrap.
 *
 * What it does
 * ------------
 *   1. Reads APP_VERSION (single source of truth: src/config/version.ts).
 *   2. Copies the production artifacts into `.releases/<version>/`.
 *   3. Stages the release in `.data/releases.json` as a candidate with a
 *      one-time verification token (loopback-only, used by the verifier).
 *   4. Prunes old releases — but NEVER the current one, the candidate, or a
 *      release that a client still has as their completed version (pruning one
 *      would force that client onto a different build, i.e. exactly the mixing
 *      we forbid).
 *
 * Usage: stage a release
 *   npm run release:publish        (= npm run build && node scripts/release-publish.mjs)
 *   npm run release                (build → stage → verify → promote, fail-closed)
 *
 * Backfilling a historical release (one that shipped before this pipeline
 * existed) is the same operation against another build directory:
 *
 *   OMID_STUDIO_PUBLISH_FROM=<dir> OMID_STUDIO_PUBLISH_VERSION=<version> \
 *     node scripts/release-publish.mjs
 */

import { cp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  RELEASES_ROOT,
  ROOT,
  artifactDirsFor,
  compareVersions,
  exists,
  generateVerifyToken,
  readArtifactBuildId,
  readClientVersions,
  readVersionFromSource,
  updateRegistry,
} from "./lib/release-registry.mjs";

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

async function main() {
  // Normally the project's own build; a historical release can be backfilled
  // from any build directory via the two environment overrides.
  const fromDir = process.env.OMID_STUDIO_PUBLISH_FROM
    ? path.resolve(ROOT, process.env.OMID_STUDIO_PUBLISH_FROM)
    : ROOT;
  /* Refuse to publish from inside the releases root. `from` and `to` must be
     different trees: publishing an artifact directory into itself deletes its
     own .next before the copy reads it, which guts the live artifact (this
     actually happened — the release's lane vanished and clients fell back to
     another build). A backfill sources from a scratch build or the project, so
     it is unaffected. */
  const relativeFrom = path.relative(RELEASES_ROOT, fromDir);
  if (relativeFrom === "" || (!relativeFrom.startsWith("..") && !path.isAbsolute(relativeFrom))) {
    fail(
      `refusing to publish from ${path.relative(ROOT, fromDir) || "."} — it is inside ${path.relative(ROOT, RELEASES_ROOT)}; publish from the project root or a separate build directory`,
    );
  }
  const version =
    process.env.OMID_STUDIO_PUBLISH_VERSION ?? (await readVersionFromSource(fromDir));
  if (!version) fail("could not parse APP_VERSION from src/config/version.ts");
  const buildIdFile = path.join(fromDir, ".next", "BUILD_ID");
  if (!(await exists(buildIdFile))) {
    fail(`no .next/BUILD_ID in ${path.relative(ROOT, fromDir) || "."} — build it first.`);
  }
  const buildId = (await readFile(buildIdFile, "utf8")).trim();

  /* The directory name is the version. When a lane is already serving that
     version its directory is its working directory and cannot be replaced on
     Windows (EBUSY), so the re-published build gets its own directory — the
     registry is what decides which artifact a version resolves to. The copy
     also lands in a SIBLING staging directory first and is renamed into place
     only when complete: a publish that dies halfway leaves the previous
     artifact intact instead of a half-written one that looks published. */
  let releaseDir = path.join(RELEASES_ROOT, version);
  if (await exists(releaseDir)) {
    await rm(releaseDir, { recursive: true, force: true }).catch(() => undefined);
    if (await exists(releaseDir)) {
      releaseDir = path.join(RELEASES_ROOT, `${version}+${buildId}`);
      log(`release ${version} is currently being served — publishing this build to ${path.basename(releaseDir)}`);
    }
  }
  const stagingDir = `${releaseDir}.staging-${process.pid}`;
  await rm(stagingDir, { recursive: true, force: true }).catch(() => undefined);
  await rm(releaseDir, { recursive: true, force: true }).catch(() => undefined);
  await mkdir(stagingDir, { recursive: true });
  try {
    for (const artifact of ARTIFACTS) {
      const source = path.join(fromDir, artifact);
      if (!(await exists(source))) continue;
      await cp(source, path.join(stagingDir, artifact), { recursive: true });
    }
    await writeFile(
      path.join(stagingDir, "RELEASE.json"),
      `${JSON.stringify({ version, buildId, publishedAt: new Date().toISOString() }, null, 2)}\n`,
      "utf8",
    );
    /* Sanity gate before the swap: an artifact that cannot serve its release
       must never replace a good one (the registry alone decides routing, so a
       gutted directory would silently strand its clients). */
    const stagedBuildId = await readArtifactBuildId(stagingDir);
    if (stagedBuildId !== buildId) {
      throw new Error(
        `staged artifact is incomplete (BUILD_ID ${stagedBuildId ?? "missing"} ≠ ${buildId})`,
      );
    }
    await rename(stagingDir, releaseDir);
  } catch (error) {
    await rm(stagingDir, { recursive: true, force: true }).catch(() => undefined);
    fail(
      `${error?.message ?? error} — the previous artifact at ${path.relative(ROOT, releaseDir)} was left untouched`,
    );
  }
  log(`published artifact ${version} (build ${buildId}) → ${path.relative(ROOT, releaseDir)}`);

  const dir = `./.releases/${path.basename(releaseDir)}`;
  const publishedAt = new Date().toISOString();
  const clientVersions = await readClientVersions();

  const staged = await updateRegistry(async (registry) => {
    const entries = new Map(registry.releases.map((entry) => [entry.version, entry]));
    const bootstrap = !registry.current;

    entries.set(version, {
      ...(entries.get(version) ?? {}),
      version,
      buildId,
      dir,
      publishedAt,
      status: bootstrap ? "current" : "candidate",
    });

    /* Deterministic ports, newest first, reused across publishes so lanes and
       their artifacts stay stable. */
    const ports = new Map(
      registry.releases
        .filter((entry) => Number.isInteger(entry.port))
        .map((entry) => [entry.version, entry.port]),
    );
    const keep = new Set([version, ...clientVersions]);
    if (registry.current) keep.add(registry.current);

    let ordered = [...entries.values()].sort((a, b) => compareVersions(b.version, a.version));
    const retained = [];
    for (const entry of ordered) {
      if (keep.has(entry.version) || retained.length < KEEP) {
        retained.push(entry);
        continue;
      }
      for (const staleDir of await artifactDirsFor(entry.version)) {
        const removed = await rm(staleDir, { recursive: true, force: true }).then(
          () => true,
          () => false,
        );
        if (removed) log(`pruned unreferenced release ${path.basename(staleDir)}`);
      }
    }
    ordered = retained;

    const used = new Set();
    ordered = ordered.map((entry, index) => {
      const preferred = ports.get(entry.version) ?? BASE_PORT + index;
      let port = preferred;
      while (used.has(port)) port += 1;
      used.add(port);
      return { ...entry, port };
    });

    const next = {
      ...registry,
      releases: ordered,
      current: bootstrap ? version : registry.current,
    };
    if (bootstrap) {
      log(`BOOTSTRAP: no current release existed — ${version} becomes current without a gate`);
      next.candidate = null;
    } else {
      next.candidate = {
        version,
        buildId,
        status: "candidate",
        publishedAt,
        verifyToken: generateVerifyToken(),
        verification: null,
        blockedReason: null,
      };
    }
    return next;
  });

  const entry = staged.releases.find((release) => release.version === version);
  log(`registry → current=${staged.current} (unchanged), candidate=${staged.candidate?.version ?? "none"} on port ${entry?.port}`);
  for (const release of staged.releases) {
    log(`  ${release.version}  port ${release.port}  ${release.status ?? "retained"}  ${release.dir}`);
  }
  if (staged.candidate) {
    log(`NOT ACTIVE YET — ${version} is a candidate. Promote it with the gate:`);
    log("  npm run verify:release -- --promote      (verifies isolation, then promotes)");
  }
}

main().catch((error) => {
  console.error("[release-publish] unexpected failure:", error);
  process.exit(1);
});
