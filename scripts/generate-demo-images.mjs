// Generates placeholder photos for demo mode (gradients with a label).
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const out = new URL("../public/demo/", import.meta.url);
await mkdir(out, { recursive: true });

const items = [
  ["recipe-pancakes", "Protein Pancakes", ["#fbbf24", "#b45309"]],
  ["recipe-bowl", "Chicken Rice Bowl", ["#4ade80", "#166534"]],
  ["recipe-pasta", "High Protein Pasta", ["#fb923c", "#9a3412"]],
  ["recipe-yogurt", "Greek Yogurt Breakfast", ["#f472b6", "#9d174d"]],
  ["wall-gym", "Gym", ["#38bdf8", "#1e3a8a"]],
  ["wall-walk", "Winter walk", ["#94a3b8", "#1e293b"]],
  ["wall-meal", "Meal prep", ["#a3e635", "#3f6212"]],
  ["wall-run", "Morning run", ["#f87171", "#7f1d1d"]],
  ["wall-view", "Uitzicht", ["#7dd3fc", "#0c4a6e"]],
  ["avatar-sam", "S", ["#38bdf8", "#0369a1"]],
  ["avatar-alex", "A", ["#fb923c", "#c2410c"]],
  ["avatar-noor", "N", ["#4ade80", "#15803d"]],
  ["upload", "Nieuwe foto", ["#7dd3fc", "#172b42"]],
];

for (const [name, label, [c1, c2]] of items) {
  const avatar = name.startsWith("avatar");
  const w = avatar ? 512 : 1000;
  const h = avatar ? 512 : 1250;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <circle cx="${w * 0.8}" cy="${h * 0.25}" r="${w * 0.25}" fill="rgba(255,255,255,0.12)"/>
  <circle cx="${w * 0.2}" cy="${h * 0.8}" r="${w * 0.35}" fill="rgba(0,0,0,0.12)"/>
  <text x="50%" y="${avatar ? "62%" : "54%"}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="${avatar ? 220 : 64}" fill="rgba(255,255,255,0.92)">${label}</text>
</svg>`;
  await sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toFile(fileURLToPath(new URL(`${name}.jpg`, out)));
}
console.log("demo images written to public/demo");
