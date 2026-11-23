/**
 * Turns a 6x4 pose sheet on a white background into a BADI sprite sheet.
 *
 *   npm run sprite -- <sheet.png|webp> <name> [--face=row,col]
 *
 * Writes public/sprites/<name>.webp: the white background removed, every pose
 * redrawn in a uniform 320x272 cell, anchored on the head in rows 1 to 3 (so
 * walking and jumping do not drift sideways) and on the body centre in row 4
 * (sitting, lying). The poses must follow the same order as anne's sheet:
 * row 1 walk, row 2 happy jump, row 3 squat jump, row 4 stand, wave, sit,
 * lean back, lie, cheer. A sheet with another order works too: give it its
 * own animation frames in src/lib/sprites.ts.
 *
 * Also writes public/sprites/<name>-face.png, the head on a cream square for
 * push notifications, cut from the standing pose (row 4, column 1 by default;
 * pass --face=row,col counted from 1 for another layout).
 */
import sharp from "sharp";

const [, , src, name, ...flags] = process.argv;
const faceFlag = flags.find((f) => f.startsWith("--face="));
const [faceRow, faceCol] = faceFlag ? faceFlag.slice(7).split(",").map((n) => Number(n) - 1) : [3, 0];
if (!src || !name || !/^[a-z0-9-]+$/.test(name)) {
  console.error("Gebruik: npm run sprite -- <bestand> <naam in kleine letters>");
  process.exit(1);
}

const COLS = 6;
const ROWS = 4;
const CW = 320;
const CH = 272;
const PAD_TOP = 16;

const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width;
const H = info.height;
const cw = W / COLS;
const ch = H / ROWS;

// 1. Background: flood fill near-white from every cell border.
const isBg = (i) => data[i] > 232 && data[i + 1] > 232 && data[i + 2] > 232;
const seen = new Uint8Array(W * H);
const stack = [];
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    const x0 = Math.round(c * cw), y0 = Math.round(r * ch), x1 = Math.round((c + 1) * cw) - 1, y1 = Math.round((r + 1) * ch) - 1;
    for (let x = x0; x <= x1; x++) stack.push(y0 * W + x, y1 * W + x);
    for (let y = y0; y <= y1; y++) stack.push(y * W + x0, y * W + x1);
  }
}
while (stack.length) {
  const p = stack.pop();
  if (seen[p]) continue;
  const i = p * 4;
  if (!isBg(i)) continue;
  seen[p] = 1;
  data[i + 3] = 0;
  const x = p % W, y = (p / W) | 0;
  if (x > 0) stack.push(p - 1);
  if (x < W - 1) stack.push(p + 1);
  if (y > 0) stack.push(p - W);
  if (y < H - 1) stack.push(p + W);
}
// Soften the light fringe next to the removed background.
for (let p = 0; p < W * H; p++) {
  const i = p * 4;
  if (data[i + 3] === 0) continue;
  const x = p % W, y = (p / W) | 0;
  const nb = [];
  if (x > 0) nb.push(p - 1);
  if (x < W - 1) nb.push(p + 1);
  if (y > 0) nb.push(p - W);
  if (y < H - 1) nb.push(p + W);
  if (!nb.some((q) => data[q * 4 + 3] === 0)) continue;
  const light = Math.min(data[i], data[i + 1], data[i + 2]);
  if (light > 200) data[i + 3] = Math.round(255 * (1 - (light - 200) / 55));
}

// 2. Figures: connected opaque areas; tiny specks are ignored.
const lab = new Int32Array(W * H).fill(-1);
const figures = [];
for (let p = 0; p < W * H; p++) {
  if (lab[p] >= 0 || data[p * 4 + 3] < 40) continue;
  const id = figures.length;
  const px = [];
  const st = [p];
  lab[p] = id;
  while (st.length) {
    const q = st.pop();
    px.push(q);
    const x = q % W, y = (q / W) | 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const r = ny * W + nx;
        if (lab[r] < 0 && data[r * 4 + 3] >= 40) {
          lab[r] = id;
          st.push(r);
        }
      }
    }
  }
  figures.push(px);
}
const poses = figures.filter((f) => f.length > 2000);
// Anne's layout has 24 poses; a sheet with three full rows (18) is fine too.
if (poses.length < COLS || poses.length > COLS * ROWS) {
  console.error(`Gevonden: ${poses.length} poses. Verwacht een raster van 6 kolommen en 3 of 4 rijen op wit.`);
  process.exit(1);
}
if (poses.length !== COLS * ROWS) console.log(`Let op: ${poses.length} poses in plaats van ${COLS * ROWS}. Stel de animaties voor deze persoon apart in.`);

// 3. Redraw every pose in its own uniform cell. The sheet is saved near-lossless:
// the art is small, and extra compression on top of the source shows.
const out = Buffer.alloc(CW * COLS * CH * ROWS * 4);
const taken = new Set();
for (const px of poses) {
  let sx = 0, sy = 0, x0 = Infinity, x1 = -1, y0 = Infinity;
  for (const q of px) {
    const x = q % W, y = (q / W) | 0;
    sx += x;
    sy += y;
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
  }
  const col = Math.floor(sx / px.length / cw);
  const row = Math.floor(sy / px.length / ch);
  const slot = `${row}:${col}`;
  if (taken.has(slot)) {
    console.error(`Twee poses vallen in hetzelfde vak (rij ${row + 1}, kolom ${col + 1}).`);
    process.exit(1);
  }
  taken.add(slot);
  let anchorX = (x0 + x1) / 2;
  if (row < 3) {
    let hx = 0, hn = 0;
    for (const q of px) {
      if (((q / W) | 0) < y0 + 70) {
        hx += q % W;
        hn++;
      }
    }
    anchorX = hx / hn;
  }
  const offX = Math.round(CW * col + CW / 2 - anchorX);
  const offY = Math.round(CH * row + PAD_TOP - row * ch);
  const all = new Set(px);
  for (const q of px) {
    for (const r of [q - 1, q + 1, q - W, q + W]) {
      if (r >= 0 && r < W * H && data[r * 4 + 3] > 0 && data[r * 4 + 3] < 40) all.add(r);
    }
  }
  for (const q of all) {
    const x = (q % W) + offX, y = ((q / W) | 0) + offY;
    if (x < CW * col || x >= CW * (col + 1) || y < CH * row || y >= CH * (row + 1)) continue;
    data.copy(out, (y * CW * COLS + x) * 4, q * 4, q * 4 + 4);
  }
}

// Face for notifications: the head of the standing pose, on a cream square.
{
  const SW = CW * COLS;
  let top = -1, hx = 0, hn = 0;
  for (let y = CH * faceRow; y < CH * (faceRow + 1) && top < 0; y++) {
    for (let x = CW * faceCol; x < CW * (faceCol + 1); x++) if (out[(y * SW + x) * 4 + 3] > 128) { top = y; break; }
  }
  if (top < 0) {
    console.error(`Geen pose gevonden voor het gezicht in rij ${faceRow + 1}, kolom ${faceCol + 1}.`);
    process.exit(1);
  }
  for (let y = top; y < top + 80; y++) {
    for (let x = CW * faceCol; x < CW * (faceCol + 1); x++) if (out[(y * SW + x) * 4 + 3] > 128) { hx += x; hn++; }
  }
  const size = 120;
  const left = Math.max(CW * faceCol, Math.min(CW * (faceCol + 1) - size, Math.round(hx / hn - size / 2)));
  const head = await sharp(out, { raw: { width: SW, height: CH * ROWS, channels: 4 } })
    .extract({ left, top: Math.max(0, top - 6), width: size, height: size })
    .resize(168)
    .png()
    .toBuffer();
  await sharp({ create: { width: 192, height: 192, channels: 4, background: "#f6ede6" } })
    .composite([{ input: head, top: 18, left: 12 }])
    .png()
    .toFile(`public/sprites/${name}-face.png`);
}

const file = `public/sprites/${name}.webp`;
await sharp(out, { raw: { width: CW * COLS, height: CH * ROWS, channels: 4 } }).webp({ nearLossless: true, quality: 60, effort: 6 }).toFile(file);
console.log(`Klaar: ${file} en public/sprites/${name}-face.png. Voeg "${name}" toe aan SPRITE_SHEETS in src/lib/sprites.ts.`);
