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

/**
 * Bram's sheet has its own order. His sitting pose comes from a separate
 * drawing without a chair (docs/wereld/bron/bram-zitten.png), sized like the
 * style example; his sleeping pose still includes his armchair.
 */
const BRAM = {
  staan: { cells: [[2, 0]], fps: 1 },
  lopen: { cells: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5]], fps: 8 },
  zitten: { files: ["docs/wereld/bron/bram-zitten.png"], figureHeight: 204, fps: 1 },
  slapen: { cells: [[3, 4], [3, 5]], fps: 0.7, withChair: true },
  zwaaien: { cells: [[2, 1], [2, 2], [2, 3], [2, 2]], fps: 4 },
  juichen: { cells: [[1, 3], [1, 2]], fps: 3 },
  blij: { cells: [[1, 1], [1, 2], [1, 3], [1, 2]], fps: 6 },
  sprongsquat: { cells: [[1, 0], [1, 1], [1, 2], [1, 3], [1, 4], [1, 5]], fps: 7 },
};

/**
 * zitAnker: the point in the sitting frame where the hips rest on the seat
 * (frame pixels). When sitting, this point goes exactly on the seat's hip
 * point, at the same scale as standing. Measured on each zitten-01.png.
 */
const PEOPLE = [
  { key: "anne", name: "Anne", layout: STANDARD, zitAnker: { x: 160, y: 168 } },
  { key: "daphne", name: "Daphne", layout: STANDARD, zitAnker: { x: 162, y: 166 } },
  { key: "irene", name: "Irene", layout: STANDARD, zitAnker: { x: 135, y: 168 } },
  { key: "bram", name: "Bram", layout: BRAM, zitAnker: { x: 130, y: 203 } },
];

/**
 * One frame from a separate drawing on a white background: the background is
 * removed, the figure is scaled to `figureHeight` and placed centred with its
 * feet where the other frames have them.
 */
async function frameFromDrawing(file, figureHeight) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const bg = (i) => data[i] > 232 && data[i + 1] > 232 && data[i + 2] > 232;
  const seen = new Uint8Array(W * H);
  const stack = [];
  for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
  while (stack.length) {
    const p = stack.pop();
    if (seen[p] || !bg(p * 4)) continue;
    seen[p] = 1;
    data[p * 4 + 3] = 0;
    const x = p % W, y = (p / W) | 0;
    if (x > 0) stack.push(p - 1);
    if (x < W - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - W);
    if (y < H - 1) stack.push(p + W);
  }
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let p = 0; p < W * H; p++) {
    if (data[p * 4 + 3] < 40) continue;
    const x = p % W, y = (p / W) | 0;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  const figure = await sharp(data, { raw: { width: W, height: H, channels: 4 } })
    .extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 })
    .resize({ height: figureHeight })
    .png()
    .toBuffer({ resolveWithObject: true });
  const left = Math.round(CW / 2 - figure.info.width / 2);
  const top = 266 - figure.info.height;
  const out = await sharp({ create: { width: CW, height: CH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: figure.data, left, top }])
    .raw()
    .toBuffer();
  return out;
}

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
    const sources = def.files ? def.files.map((f) => ({ file: f })) : def.cells.map((cell) => ({ cell }));
    for (const [i, source] of sources.entries()) {
      let data;
      if (source.file) data = await frameFromDrawing(source.file, def.figureHeight);
      else {
        const [r, c] = source.cell;
        data = Buffer.alloc(CW * CH * 4);
        for (let y = 0; y < CH; y++) {
          const from = ((r * CH + y) * sheet.info.width + c * CW) * 4;
          sheet.data.copy(data, y * CW * 4, from, from + CW * 4);
        }
      }
      const file = `${anim}-${String(i + 1).padStart(2, "0")}.png`;
      await sharp(data, { raw: { width: CW, height: CH, channels: 4 } }).png({ compressionLevel: 9 }).toFile(path.join(dir, file));
      frames.push({ data });
      files.push(file);
    }
    animations[anim] = { frames: files, fps: def.fps, loop: true, anchor: anchorOf(frames), ...(def.withChair ? { withChair: true } : {}) };
  }
  const manifest = { name: person.name, frameWidth: CW, frameHeight: CH, mirrorForLeft: true, zitAnker: person.zitAnker, animations };
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(`${person.name}: ${Object.values(animations).reduce((n, a) => n + a.frames.length, 0)} frames`);
}
