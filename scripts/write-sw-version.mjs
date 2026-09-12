/**
 * Writes the centralized APP_VERSION (src/config/version.ts) into
 * public/sw.js, replacing the `__APP_VERSION__` placeholder. Runs before
 * `build` and `dev` so the service worker always carries the current
 * version — a bump produces a byte-different worker, which is what makes
 * the PWA update mechanism detect a new deployment.
 */
import { readFileSync, writeFileSync } from "node:fs";

const versionSrc = readFileSync("src/config/version.ts", "utf8");
const match = versionSrc.match(/export const APP_VERSION = \"([^\"]+)\"/);
if (!match) {
  console.error("write-sw-version: could not parse APP_VERSION from src/config/version.ts");
  process.exit(1);
}

const version = match[1];
const swPath = "public/sw.js";
const sw = readFileSync(swPath, "utf8");

const pattern = /const APP_VERSION = "[^"]*";/;
if (!pattern.test(sw)) {
  console.error(
    "write-sw-version: const APP_VERSION = \"…\" not found in public/sw.js",
  );
  process.exit(1);
}

writeFileSync(swPath, sw.replace(pattern, `const APP_VERSION = "${version}";`));
console.log(`write-sw-version: embedded APP_VERSION ${version} into ${swPath}`);