/**
 * Builds the characters for BADI Wereld:
 *
 *   npm run wereld:poppetjes
 *
 * For every sheet in public/sprites it writes public/wereld/poppetjes/<naam>/:
 * loose transparent frames of 320 x 272 (`<animatie>-01.png` …) and a
 * manifest.json with, per animation, the frames, the speed and the anchor
 * point (centre under the feet, fixed per animation so nobody jumps). The
 * world reads only the manifest; frame counts and speeds are never hardcoded
 * in the app. Add a new character to PEOPLE below with the layout of its
 * sheet, then run this again.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const sharp = createRequire(process.cwd() + "/")("sharp");

const CW = 320;
const CH = 272;

/** Frames per animation as [row, column] in a sheet; speed in frames per second. */
const STANDARD = {
  staan: { cells: [[3, 0]], fps: 1 },
  lopen: { cells: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5]], fps: 8 },
  zitten: { cells: [[3, 2], [3, 3]], fps: 1 },
  slapen: { cells: [[3, 4]], fps: 1 },
  zwaaien: { cells: [[3, 0], [3, 1]], fps: 2.5 },
  juichen: { cells: [[3, 5], [2, 3]], fps: 3 },
  blij: { cells: [[1, 0], [1, 1], [1, 2], [1, 3], [1, 4], [1, 5]], fps: 7 },
  sprongsquat: { cells: [[2, 0], [2, 1], [2, 2], [2, 3], [2, 4], [2, 5]], fps: 7 },
};

/** Bram's sheet has its own order; his sitting and sleeping poses include his armchair. */
const BRAM = {
  staan: { cells: [[2, 0]], fps: 1 },
  lopen: { cells: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5]], fps: 8 },
  zitten: { cells: [[3, 1], [3, 2]], fps: 1, withChair: true },
  slapen: { cells: [[3, 4], [3, 5]], fps: 0.7, withChair: true },
  zwaaien: { cells: [[2, 1], [2, 2], [2, 3], [2, 2]], fps: 4 },
  juichen: { cells: [[1, 3], [1, 2]], fps: 3 },
  blij: { cells: [[1, 1], [1, 2], [1, 3], [1, 2]], fps: 6 },
  sprongsquat: { cells: [[1, 0], [1, 1], [1, 2], [1, 3], [1, 4], [1, 5]], fps: 7 },
};

const PEOPLE = [
  { key: "anne", name: "Anne", layout: STANDARD },
  { key: "daphne", name: "Daphne", layout: STANDARD },
  { key: "irene", name: "Irene", layout: STANDARD },
  { key: "bram", name: "Bram", layout: BRAM },
];

/** Lowest opaque row and the centre of the opaque pixels near it, over all frames of one animation. */
function anchorOf(frames) {
  let bottom = 0;
  for (const { data } of frames) {
    for (let y = CH - 1; y >= 0; y--) {
      let hit = false;
      for (let x = 0; x < CW; x++) if (data[(y * CW + x) * 4 + 3] > 128) { hit = true; break; }
      if (hit) { bottom = Math.max(bottom, y); break; }
    }
  }
  let sx = 0, n = 0;
  for (const { data } of frames) {
    for (let y = Math.max(0, bottom - 14); y <= bottom; y++) {
      for (let x = 0; x < CW; x++) if (data[(y * CW + x) * 4 + 3] > 128) { sx += x; n++; }
    }
  }
  return { x: n ? Math.round(sx / n) : CW / 2, y: bottom + 1 };
}

for (const person of PEOPLE) {
  const dir = path.join("public/wereld/poppetjes", person.key);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const sheet = await sharp(`public/sprites/${person.key}.webp`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const animations = {};
  for (const [anim, def] of Object.entries(person.layout)) {
    const frames = [];
    const files = [];
    for (const [i, [r, c]] of def.cells.entries()) {
      const data = Buffer.alloc(CW * CH * 4);
      for (let y = 0; y < CH; y++) {
        const from = ((r * CH + y) * sheet.info.width + c * CW) * 4;
        sheet.data.copy(data, y * CW * 4, from, from + CW * 4);
      }
      const file = `${anim}-${String(i + 1).padStart(2, "0")}.png`;
      await sharp(data, { raw: { width: CW, height: CH, channels: 4 } }).png({ compressionLevel: 9 }).toFile(path.join(dir, file));
      frames.push({ data });
      files.push(file);
    }
    animations[anim] = { frames: files, fps: def.fps, loop: true, anchor: anchorOf(frames), ...(def.withChair ? { withChair: true } : {}) };
  }
  const manifest = { name: person.name, frameWidth: CW, frameHeight: CH, mirrorForLeft: true, animations };
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(`${person.name}: ${Object.values(animations).reduce((n, a) => n + a.frames.length, 0)} frames`);
}
