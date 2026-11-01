// Brand-styled placeholder photos for the seeded recipes (replace via "Recept bewerken").
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../public/recipes/", import.meta.url));
await mkdir(out, { recursive: true });

const items = [
  ["overnight-oats", "Overnight oats", "ONTBIJT", ["#f3e3d6", "#d9bca8"]],
  ["kip-wrap", "Kip-hummus wrap", "MIDDAGETEN", ["#e9d6c4", "#c9a98f"]],
  ["zalm-zoete-aardappel", "Zalm met zoete aardappel", "AVONDETEN", ["#e4cdbd", "#b98c75"]],
  ["kip-teriyaki-bowl", "Kip-teriyaki bowl", "AVONDETEN", ["#dfd6c3", "#a9ab8c"]],
  ["kwark-walnoot", "Kwark met walnoot", "TUSSENDOORTJE", ["#f1e4da", "#cdb5a3"]],
];

for (const [name, , , [c1, c2]] of items) {
  const w = 1000;
  const h = 1250;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>
    <radialGradient id="r" cx="0.7" cy="0.3" r="0.6"><stop offset="0" stop-color="#ffffff" stop-opacity="0.55"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <rect width="${w}" height="${h}" fill="url(#r)"/>
  <circle cx="${w * 0.5}" cy="${h * 0.42}" r="${w * 0.3}" fill="#ffffff" fill-opacity="0.35"/>
  <circle cx="${w * 0.5}" cy="${h * 0.42}" r="${w * 0.22}" fill="#ffffff" fill-opacity="0.45"/>
  <ellipse cx="${w * 0.5}" cy="${h * 0.44}" rx="${w * 0.17}" ry="${w * 0.13}" fill="${c2}" fill-opacity="0.35"/>
  <circle cx="${w * 0.42}" cy="${h * 0.41}" r="${w * 0.06}" fill="#ffffff" fill-opacity="0.55"/>
  <circle cx="${w * 0.56}" cy="${h * 0.46}" r="${w * 0.045}" fill="#ffffff" fill-opacity="0.4"/>
</svg>`;
  await sharp(Buffer.from(svg)).jpeg({ quality: 82, mozjpeg: true }).toFile(out + name + ".jpg");
}
console.log("recipe images written to public/recipes");
