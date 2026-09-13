#!/usr/bin/env node
/**
 * release-promote.mjs — promote an ALREADY-VERIFIED candidate to current.
 *
 * This is the only promotion entry point besides `release-verify --promote`, and
 * it is deliberately unable to verify anything itself: it refuses unless the
 * registry already carries a successful isolation verification for exactly this
 * artifact (status "verified", zero failed checks, matching build id). Running
 * it without that is an error, not a shortcut — publishing an artifact and
 * promoting it are separate, gated steps.
 *
 * Usage: npm run release:promote
 */

import {
  promoteCandidate,
  readRegistry,
  releaseEntry,
  updateRegistry,
} from "./lib/release-registry.mjs";

async function main() {
  const before = await readRegistry();
  const candidate = before.candidate;
  if (!candidate) {
    console.error("[release-promote] REFUSED: no candidate release is staged");
    process.exit(1);
  }
  const entry = releaseEntry(before, candidate.version);
  console.log(
    `[release-promote] candidate ${candidate.version} status=${candidate.status} ` +
      `verified=${candidate.verification?.checkedAt ?? "never"} failedChecks=${candidate.verification?.failed ?? "n/a"} ` +
      `artifact=${entry?.dir ?? "missing"}`,
  );

  let result = null;
  const registry = await updateRegistry(async (current) => {
    result = await promoteCandidate(current);
    return current;
  });

  if (!result?.ok) {
    console.error(`[release-promote] REFUSED: ${result?.reason}`);
    console.error(`[release-promote] current release is still ${registry.current}`);
    process.exit(1);
  }
  console.log(`[release-promote] PROMOTED: current ${result.previous ?? "none"} → ${result.version}`);
  console.log("[release-promote] the router picks this up within ~1s; clients keep their own releases until they update");
}

main().catch((error) => {
  console.error("[release-promote] unexpected failure:", error);
  process.exit(1);
});
