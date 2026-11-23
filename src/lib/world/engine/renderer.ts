/**
 * Draws a scene on a canvas: the background, the characters from back to
 * front with a soft shadow, and the furniture they stand behind on top of
 * them. A camera (centre and zoom, in background pixels) frames the view.
 */
import { animationOf, type Avatar } from "./avatar";
import { backToFront, occludersOver } from "./depth";
import type { Grid } from "./grid";
import type { LoadedCharacter } from "./sprites";
import { frameIndex } from "./sprites";
import type { SceneDef } from "./scene";

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export interface View {
  width: number;
  height: number;
  dpr: number;
}

export function clampCamera(cam: Camera, scene: SceneDef, view: View): Camera {
  const halfW = view.width / 2 / cam.zoom;
  const halfH = view.height / 2 / cam.zoom;
  const x = scene.width <= halfW * 2 ? scene.width / 2 : Math.min(scene.width - halfW, Math.max(halfW, cam.x));
  const y = scene.height <= halfH * 2 ? scene.height / 2 : Math.min(scene.height - halfH, Math.max(halfH, cam.y));
  return { x, y, zoom: cam.zoom };
}

/** Screen point (CSS pixels) to background pixels. */
export function screenToScene(sx: number, sy: number, cam: Camera, view: View): [number, number] {
  return [cam.x + (sx - view.width / 2) / cam.zoom, cam.y + (sy - view.height / 2) / cam.zoom];
}

function characterBox(c: LoadedCharacter, a: Avatar, height: number) {
  const anim = c.manifest.animations[animationOf(a)] ?? c.manifest.animations.staan;
  const s = height / c.manifest.frameHeight;
  return { x: a.feet[0] - c.manifest.frameWidth * s * 0.5, y: a.feet[1] - anim.anchor.y * s, w: c.manifest.frameWidth * s, h: anim.anchor.y * s };
}

function drawCharacter(ctx: CanvasRenderingContext2D, c: LoadedCharacter, a: Avatar, height: number, now: number, deviceScale: number) {
  const name = animationOf(a);
  const anim = c.manifest.animations[name] ?? c.manifest.animations.staan;
  const cells = c.cells[name] ?? c.cells.staan;
  const cell = cells[frameIndex(anim.fps, cells.length, now - a.since)];
  const s = height / c.manifest.frameHeight;
  const { frameWidth: fw, frameHeight: fh } = c.manifest;
  // soft shadow under the feet
  if (a.state !== "sit") {
    ctx.save();
    ctx.fillStyle = "rgba(70, 35, 20, 0.22)";
    ctx.beginPath();
    ctx.ellipse(a.feet[0], a.feet[1] - 2, 62 * (height / 370), 15 * (height / 370), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.save();
  ctx.imageSmoothingEnabled = deviceScale * s <= 1.05;
  ctx.imageSmoothingQuality = "high";
  ctx.translate(a.feet[0], a.feet[1]);
  if (a.facing === "left") ctx.scale(-1, 1);
  ctx.drawImage(c.atlas, cell.sx, cell.sy, fw, fh, -anim.anchor.x * s, -anim.anchor.y * s, fw * s, fh * s);
  ctx.restore();
}

export interface RenderInput {
  ctx: CanvasRenderingContext2D;
  scene: SceneDef;
  background: HTMLImageElement;
  outlines: Map<string, Path2D>;
  avatars: Avatar[];
  characters: Map<string, LoadedCharacter>;
  cam: Camera;
  view: View;
  now: number;
  grid?: Grid | null;
  debug?: boolean;
  page: string;
}

export function render({ ctx, scene, background, outlines, avatars, characters, cam, view, now, grid, debug, page }: RenderInput) {
  const { width, height, dpr } = view;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = page;
  ctx.fillRect(0, 0, width * dpr, height * dpr);
  const z = cam.zoom * dpr;
  ctx.setTransform(z, 0, 0, z, dpr * (width / 2 - cam.x * cam.zoom), dpr * (height / 2 - cam.y * cam.zoom));
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(background, 0, 0, scene.width, scene.height);

  for (const a of backToFront(avatars)) {
    const c = characters.get(a.character);
    if (!c) continue;
    drawCharacter(ctx, c, a, scene.characterHeight, now, z);
    const seat = a.seat ? scene.seats.find((s) => s.id === a.seat) : null;
    for (const o of occludersOver(a.feet, characterBox(c, a, scene.characterHeight), scene.occluders, seat?.sitsOn ?? a.ignore)) {
      const path = outlines.get(o.id);
      if (!path) continue;
      ctx.save();
      ctx.clip(path);
      ctx.drawImage(background, 0, 0, scene.width, scene.height);
      ctx.restore();
    }
  }

  if (debug && grid) drawDebug(ctx, scene, grid, outlines);
}

function drawDebug(ctx: CanvasRenderingContext2D, scene: SceneDef, grid: Grid, outlines: Map<string, Path2D>) {
  ctx.save();
  ctx.lineWidth = 2;
  for (let u = 0; u < grid.n; u++) {
    for (let v = 0; v < grid.n; v++) {
      const p = [grid.tileToPx(u, v), grid.tileToPx(u + 1, v), grid.tileToPx(u + 1, v + 1), grid.tileToPx(u, v + 1)];
      ctx.beginPath();
      p.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fillStyle = grid.walk[u][v] ? "rgba(80,180,90,0.22)" : "rgba(220,60,60,0.22)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.stroke();
    }
  }
  ctx.strokeStyle = "#1e6fd9";
  ctx.lineWidth = 4;
  for (const o of scene.occluders) {
    const path = outlines.get(o.id);
    if (path) ctx.stroke(path);
    ctx.beginPath();
    o.front.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.strokeStyle = "#f0a020";
    ctx.stroke();
    ctx.strokeStyle = "#1e6fd9";
  }
  ctx.fillStyle = "#d9338a";
  for (const s of scene.seats) {
    ctx.beginPath();
    ctx.arc(s.feet[0], s.feet[1], 10, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
