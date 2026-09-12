/**
 * Generates PWA icons from the OMID Studio brand mark.
 *
 *   npm run icons
 *
 * Requires sharp (devDependency). Outputs to public/icons/.
 * Re-run whenever the brand mark in this file changes.
 */
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "public", "icons");

const gradient = `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#a78bfa"/>
      <stop offset="0.5" stop-color="#7c8cff"/>
      <stop offset="1" stop-color="#55c1ff"/>
    </linearGradient>`;

/** App icon — ink rounded square with the gradient mark. */
const appIcon = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <defs>${gradient}</defs>
  <rect width="64" height="64" rx="14" fill="#060609"/>
  <path d="M22 45V19l20 26V19" stroke="url(#g)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>`;

/** Maskable icon — full-bleed background (no rounded corners) so platform masks can crop safely. */
const maskableIcon = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <defs>${gradient}</defs>
  <rect width="64" height="64" fill="#060609"/>
  <path d="M22 45V19l20 26V19" stroke="url(#g)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>`;

async function render(svg, name, size) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(path.join(outDir, name));
  console.log(`✓ public/icons/${name}`);
}

await mkdir(outDir, { recursive: true });

// Fall back to the source SVG if it still matches the mark, otherwise use appIcon().
let source = null;
try {
  source = await readFile(path.join(root, "src", "app", "icon.svg"), "utf8");
} catch {
  source = appIcon(512);
}

await render(source, "icon-192.png", 192);
await render(source, "icon-512.png", 512);
await render(appIcon(180), "apple-touch-icon.png", 180);
await render(maskableIcon(512), "icon-maskable-512.png", 512);
console.log("Done.");
