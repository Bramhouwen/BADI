// Generates the PWA icon set: dark BADI runner on the cream brand gradient.
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../public/icons/", import.meta.url));
const runner = fileURLToPath(new URL("../public/brand/runner-dark.png", import.meta.url));
await mkdir(out, { recursive: true });

function background(size, radius) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fbf3ee"/>
      <stop offset="1" stop-color="#e9d3c8"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.3" r="0.65">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.7"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${radius}" fill="url(#bg)"/>
  <rect width="${size}" height="${size}" rx="${radius}" fill="url(#glow)"/>
</svg>`);
}

async function icon(name, size, { maskable = false } = {}) {
  const pad = Math.round(size * (maskable ? 0.2 : 0.14));
  const inner = size - pad * 2;
  const logo = await sharp(runner).resize({ width: inner, height: inner, fit: "inside" }).png().toBuffer();
  const meta = await sharp(logo).metadata();
  await sharp(background(size, maskable ? 0 : Math.round(size * 0.22)))
    .composite([{ input: logo, left: Math.round((size - meta.width) / 2), top: Math.round((size - meta.height) / 2) }])
    .png()
    .toFile(out + name);
}

await icon("icon-192.png", 192);
await icon("icon-512.png", 512);
await icon("icon-maskable-512.png", 512, { maskable: true });
await icon("apple-touch-icon.png", 180, { maskable: true });
await icon("../favicon.png", 64);
console.log("icons written to public/icons");
