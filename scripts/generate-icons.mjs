// Generates the PWA icon set from an inline snowflake SVG using sharp.
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const out = new URL("../public/icons/", import.meta.url);
await mkdir(out, { recursive: true });

function svg(size, { maskable = false } = {}) {
  const pad = maskable ? size * 0.18 : size * 0.1;
  const r = maskable ? 0 : size * 0.22;
  const c = size / 2;
  const arm = size / 2 - pad;
  const stroke = Math.max(4, size * 0.055);
  const arms = [0, 60, 120]
    .map(
      (deg) => `
    <g transform="rotate(${deg} ${c} ${c})">
      <line x1="${c}" y1="${c - arm}" x2="${c}" y2="${c + arm}" />
      <line x1="${c}" y1="${c - arm * 0.72}" x2="${c - arm * 0.26}" y2="${c - arm * 0.46}" />
      <line x1="${c}" y1="${c - arm * 0.72}" x2="${c + arm * 0.26}" y2="${c - arm * 0.46}" />
      <line x1="${c}" y1="${c + arm * 0.72}" x2="${c - arm * 0.26}" y2="${c + arm * 0.46}" />
      <line x1="${c}" y1="${c + arm * 0.72}" x2="${c + arm * 0.26}" y2="${c + arm * 0.46}" />
    </g>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#172B42"/>
      <stop offset="1" stop-color="#08111F"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.35" r="0.6">
      <stop offset="0" stop-color="#38BDF8" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#38BDF8" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${r}" fill="url(#bg)"/>
  <rect width="${size}" height="${size}" rx="${r}" fill="url(#glow)"/>
  <g stroke="#7DD3FC" stroke-width="${stroke}" stroke-linecap="round" fill="none">${arms}</g>
  <circle cx="${c}" cy="${c}" r="${stroke * 0.9}" fill="#F0F9FF"/>
</svg>`;
}

const targets = [
  ["icon-192.png", 192, false],
  ["icon-512.png", 512, false],
  ["icon-maskable-512.png", 512, true],
  ["apple-touch-icon.png", 180, true],
];
for (const [name, size, maskable] of targets) {
  await sharp(Buffer.from(svg(size, { maskable }))).png().toFile(fileURLToPath(new URL(name, out)));
}
await writeFile(new URL("icon.svg", out), svg(512));
// Favicon for the browser tab.
await sharp(Buffer.from(svg(64))).png().toFile(fileURLToPath(new URL("../public/favicon.png", import.meta.url)));
console.log("icons written to public/icons");
