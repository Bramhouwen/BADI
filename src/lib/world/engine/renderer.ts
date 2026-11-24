/**
 * Draws a scene on a canvas: the background, the characters from back to
 * front with a soft shadow, and the furniture they stand behind on top of
 * them. A camera (centre and zoom, in background pixels) frames the view.
 */
import { animationOf, type Avatar } from "./avatar";
import { backToFront, occludersOver } from "./depth";
import type { Polygon, Pt } from "./geometry";
import type { Grid } from "./grid";
import type { LoadedCharacter } from "./sprites";
import { frameIndex } from "./sprites";
import { characterHeightAt, type SceneDef, type Seat } from "./scene";
import { occluderUnder, seatForeground, seatOccluder } from "./seats";
import { lineAlpha, placeBalloon, stackTops, type ChatLine } from "./chat-strip";

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

/** Where the frame's anchor goes, in frame pixels: the feet when standing, the hips (zitAnker) when sitting. */
function anchorOf(c: LoadedCharacter, a: Avatar) {
  if (a.state === "sit" && a.pose === "zitten" && c.manifest.zitAnker) return c.manifest.zitAnker;
  return (c.manifest.animations[animationOf(a)] ?? c.manifest.animations.staan).anchor;
}

function characterBox(c: LoadedCharacter, a: Avatar, height: number) {
  const s = height / c.manifest.frameHeight;
  const anchor = anchorOf(c, a);
  return { x: a.feet[0] - c.manifest.frameWidth * s * 0.5, y: a.feet[1] - anchor.y * s, w: c.manifest.frameWidth * s, h: c.manifest.frameHeight * s };
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
    const k = height / 370;
    ctx.save();
    ctx.fillStyle = "rgba(70, 35, 20, 0.22)";
    ctx.beginPath();
    ctx.ellipse(a.feet[0], a.feet[1] - 2 * k, 62 * k, 15 * k, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.save();
  ctx.imageSmoothingEnabled = deviceScale * s <= 1.05;
  ctx.imageSmoothingQuality = "high";
  // Standing: the feet anchor on the feet. Sitting: the zitAnker (hips) on the seat's hip point.
  const anchor = anchorOf(c, a);
  ctx.translate(a.feet[0], a.feet[1]);
  if (a.facing === "left") ctx.scale(-1, 1);
  ctx.drawImage(c.atlas, cell.sx, cell.sy, fw, fh, -anchor.x * s, -anchor.y * s, fw * s, fh * s);
  ctx.restore();
}

const paths = new WeakMap<Polygon, Path2D>();
/** A polygon as a canvas path, made once. */
function pathOf(poly: Polygon): Path2D {
  let p = paths.get(poly);
  if (!p) {
    p = new Path2D();
    const path = p;
    poly.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)));
    p.closePath();
    paths.set(poly, p);
  }
  return p;
}

/** Text over the world, the same size at any zoom: balloons, name tags, the moon of someone offline. */
export interface Labels {
  /** Your own id: no name tag over yourself. */
  me: string;
  /** The character someone tapped: shows its name. */
  selected: string | null;
  /** Unread private messages: over the sender (only you see it), and the total over yourself. */
  unread?: ReadonlyMap<string, number>;
  /** Who is typing a private message to you. */
  typing?: ReadonlySet<string>;
  /** Status icons by status key. */
  statusIcons?: Readonly<Record<string, { icon: string }>>;
  /** The conversation strip: what is said in the room, and where the strip starts (CSS pixels from the top, under the top bar). */
  chat?: { lines: ChatLine[]; top: number };
}

/** A loose picture standing in the scene (furniture in a room), sorted with the characters by depth. */
export interface Prop {
  img: CanvasImageSource;
  /** Bottom centre of the picture, its drawn size, and whether it is mirrored. */
  x: number;
  y: number;
  w: number;
  h: number;
  flip: boolean;
  /** Drawing order, like a character's feet. */
  depth: number;
  /** Lies on the floor: drawn before everything else. */
  flat: boolean;
  /** Highlight while furnishing: its footprint in green (fits) or red (does not). */
  outline?: { poly: Polygon; ok: boolean } | null;
  alpha?: number;
  /** Turned around the middle of the picture, in degrees clockwise (the Weekrad). */
  rotate?: number;
  /** Drawn on top of the picture without turning (the Weekrad's pointer), in the same box. */
  overlay?: CanvasImageSource;
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
  labels?: Labels;
  /** Furniture in a room. */
  props?: Prop[];
  /** Characters sitting on a piece of furniture are drawn just in front of it: seat id to its depth. */
  seatDepth?: ReadonlyMap<string, number>;
}

function drawProp(ctx: CanvasRenderingContext2D, p: Prop) {
  if (p.outline) {
    ctx.save();
    ctx.beginPath();
    p.outline.poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = p.outline.ok ? "rgba(63,143,79,0.28)" : "rgba(201,87,58,0.32)";
    ctx.strokeStyle = p.outline.ok ? "#3f8f4f" : "#c9573a";
    ctx.lineWidth = 4;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  ctx.save();
  if (p.alpha !== undefined) ctx.globalAlpha = p.alpha;
  ctx.translate(p.x, p.y);
  if (p.flip) ctx.scale(-1, 1);
  if (p.rotate) {
    ctx.save();
    ctx.translate(0, -p.h / 2);
    ctx.rotate((p.rotate * Math.PI) / 180);
    ctx.drawImage(p.img, -p.w / 2, -p.h / 2, p.w, p.h);
    ctx.restore();
  } else ctx.drawImage(p.img, -p.w / 2, -p.h, p.w, p.h);
  if (p.overlay) ctx.drawImage(p.overlay, -p.w / 2, -p.h, p.w, p.h);
  ctx.restore();
}

export function render({ ctx, scene, background, outlines, avatars, characters, cam, view, now, grid, debug, page, labels, props = [], seatDepth }: RenderInput) {
  const { width, height, dpr } = view;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = page;
  ctx.fillRect(0, 0, width * dpr, height * dpr);
  const z = cam.zoom * dpr;
  ctx.setTransform(z, 0, 0, z, dpr * (width / 2 - cam.x * cam.zoom), dpr * (height / 2 - cam.y * cam.zoom));
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(background, 0, 0, scene.width, scene.height);
  for (const p of props) if (p.flat) drawProp(ctx, p);

  // Characters and standing furniture together, back to front.
  type Item = { depth: number; prop?: Prop; avatar?: Avatar };
  const order: Item[] = [
    ...props.filter((p) => !p.flat).map((prop) => ({ depth: prop.depth, prop })),
    ...avatars.map((avatar) => ({ depth: avatar.state === "sit" && avatar.seat && seatDepth?.has(avatar.seat) ? seatDepth.get(avatar.seat)! + 0.5 : avatar.feet[1], avatar })),
  ].sort((x, y) => x.depth - y.depth);

  for (const it of order) {
    if (it.prop) {
      drawProp(ctx, it.prop);
      continue;
    }
    const a = it.avatar!;
    const c = characters.get(a.character);
    if (!c) continue;
    if (a.trained && !a.offline) drawGlow(ctx, a, characterHeightAt(scene, a.feet[1]), now);
    if (a.offline) ctx.globalAlpha = 0.6;
    drawCharacter(ctx, c, a, characterHeightAt(scene, a.feet[1]), now, z);
    ctx.globalAlpha = 1;
    const seat = a.seat ? scene.seats.find((s) => s.id === a.seat) : null;
    const spot = a.spot ? scene.spots.find((s) => s.id === a.spot) : null;
    const exclude = seat ? seatOccluder(scene.occluders, seat) : spot ? occluderUnder(scene.occluders, spot.at) : a.ignore;
    for (const o of occludersOver(a.feet, characterBox(c, a, characterHeightAt(scene, a.feet[1])), scene.occluders, exclude)) {
      const path = outlines.get(o.id);
      if (!path) continue;
      ctx.save();
      ctx.clip(path);
      ctx.drawImage(background, 0, 0, scene.width, scene.height);
      ctx.restore();
    }
    // Sitting: the armrest or backrest in front of you goes over you.
    if (seat && a.state === "sit") {
      for (const poly of seatForeground(scene.occluders, seat)) {
        ctx.save();
        ctx.clip(pathOf(poly));
        ctx.drawImage(background, 0, 0, scene.width, scene.height);
        ctx.restore();
      }
    }
  }

  if (debug && grid) drawDebug(ctx, scene, grid, outlines);
  if (labels) drawLabels(ctx, scene, avatars, characters, cam, view, now, labels);
}

/** Where the top of a character's head is on screen (CSS pixels). */
function headOnScreen(c: LoadedCharacter, a: Avatar, scene: SceneDef, cam: Camera, view: View): Pt {
  const box = characterBox(c, a, characterHeightAt(scene, a.feet[1]));
  // The frames have empty space above the head; the head starts about a sixth down.
  const top = box.y + box.h * 0.16;
  return [view.width / 2 + (a.feet[0] - cam.x) * cam.zoom, view.height / 2 + (top - cam.y) * cam.zoom];
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Wraps a line into at most three lines that fit `max` pixels wide. */
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width <= max || !line) line = next;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  if (lines.length > 3) {
    lines.length = 3;
    lines[2] = lines[2].replace(/\s*\S*$/, "") + "…";
  }
  return lines;
}

function drawLabels(ctx: CanvasRenderingContext2D, scene: SceneDef, avatars: Avatar[], characters: Map<string, LoadedCharacter>, cam: Camera, view: View, now: number, labels: Labels) {
  ctx.save();
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  for (const a of backToFront(avatars)) {
    const c = characters.get(a.character);
    if (!c) continue;
    const [hx, hy] = headOnScreen(c, a, scene, cam, view);
    let top = hy - 8;
    // offline: a small moon
    if (a.offline) {
      const r = 11;
      const cx = hx + 18, cy = top - r;
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.rect(cx - r, cy - r, r * 2, r * 2);
      ctx.arc(cx + 3.2, cy - 2.4, 5.4, 0, Math.PI * 2);
      ctx.clip("evenodd");
      ctx.fillStyle = "#d39a2c";
      ctx.beginPath();
      ctx.arc(cx, cy, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // what they are up to: an icon (not while offline, the moon says enough)
    const statusIcon = !a.offline && a.status ? labels.statusIcons?.[a.status]?.icon : null;
    if (statusIcon) drawBadge(ctx, hx + 20, top - 12, statusIcon);
    // unread private messages: an envelope with the number
    const count = labels.unread?.get(a.id) ?? 0;
    if (count > 0) {
      drawEnvelope(ctx, hx - (a.offline || statusIcon ? 18 : 0), top - 14, count);
      top -= 30;
    }
    // typing a private message to you: three dots
    if (labels.typing?.has(a.id)) {
      roundRect(ctx, hx - 22, top - 24, 44, 22, 11);
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.fill();
      for (let i = 0; i < 3; i++) {
        const lift = Math.sin(now / 160 - i * 0.9) * 2;
        ctx.fillStyle = "#8a7468";
        ctx.beginPath();
        ctx.arc(hx - 10 + i * 10, top - 13 + lift, 2.8, 0, Math.PI * 2);
        ctx.fill();
      }
      top -= 28;
    }
    // name tag of the one you tapped
    if (labels.selected === a.id && a.id !== labels.me) {
      ctx.font = "600 13px ui-sans-serif, system-ui, sans-serif";
      const w = ctx.measureText(a.name).width + 20;
      roundRect(ctx, hx - w / 2, top - 26, w, 24, 12);
      ctx.fillStyle = "rgba(43,29,24,0.88)";
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillText(a.name, hx, top - 14);
      top -= 30;
    }
    // just said something in the room: a small balloon icon (the words are in the strip at the top)
    if (a.speech && a.speech.until > now && !a.speech.private) {
      ctx.globalAlpha = Math.min(1, (a.speech.until - now) / 400);
      drawBadge(ctx, hx, top - 14, "💬");
      ctx.globalAlpha = 1;
      top -= 30;
    }
    // a private message: the balloon over the sender
    if (a.speech && a.speech.until > now && a.speech.private) {
      ctx.font = "500 14px ui-sans-serif, system-ui, sans-serif";
      const lines = wrap(ctx, a.speech.text, 190);
      const lock = a.speech.private ? 18 : 0;
      const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 24 + lock;
      const h = lines.length * 18 + 14;
      const fade = Math.min(1, (a.speech.until - now) / 400);
      ctx.globalAlpha = fade;
      const bx = Math.max(6, Math.min(view.width - w - 6, hx - w / 2));
      const by = top - h - 10;
      ctx.shadowColor = "rgba(43,29,24,0.18)";
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 2;
      roundRect(ctx, bx, by, w, h, 14);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.shadowColor = "transparent";
      // tail
      ctx.beginPath();
      ctx.moveTo(hx - 7, by + h - 1);
      ctx.lineTo(hx, by + h + 8);
      ctx.lineTo(hx + 7, by + h - 1);
      ctx.closePath();
      ctx.fill();
      if (lock) drawLock(ctx, bx + 16, by + h / 2);
      ctx.fillStyle = "#2b1d18";
      lines.forEach((l, i) => ctx.fillText(l, bx + lock + (w - lock) / 2, by + 7 + 9 + i * 18));
      ctx.globalAlpha = 1;
    }
  }
  if (labels.chat?.lines.length) drawChatStrip(ctx, scene, avatars, characters, cam, view, now, labels.chat.lines, labels.chat.top);
  ctx.restore();
}

/** The face of a character in a circle, cut from its standing picture. */
function drawFace(ctx: CanvasRenderingContext2D, c: LoadedCharacter, cx: number, cy: number, r: number) {
  const cell = (c.cells.staan ?? Object.values(c.cells)[0])?.[0];
  if (!cell) return;
  const { frameHeight: fh } = c.manifest;
  const anchor = c.manifest.animations.staan?.anchor ?? { x: c.manifest.frameWidth / 2, y: fh };
  const fr = fh * 0.16;
  const fx = anchor.x, fy = fh * 0.25;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = "#f6ece4";
  ctx.fill();
  ctx.clip();
  ctx.drawImage(c.atlas, cell.sx + fx - fr, cell.sy + fy - fr, fr * 2, fr * 2, cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
}

/**
 * The conversation strip: every line as a balloon with face and name, above
 * the one who said it, newest at the bottom and the older ones pushed up.
 * The same size at any zoom. Someone out of view gets an arrow to their side.
 */
function drawChatStrip(ctx: CanvasRenderingContext2D, scene: SceneDef, avatars: Avatar[], characters: Map<string, LoadedCharacter>, cam: Camera, view: View, now: number, lines: ChatLine[], top: number) {
  // the newest line sits here; older ones go up and fade out under the top bar
  const floor = top + Math.min(170, view.height * 0.3);
  const maxText = Math.min(240, view.width - 90);
  const face = 13;
  const shapes = lines.map((l) => {
    ctx.font = "500 14px ui-sans-serif, system-ui, sans-serif";
    const text = wrap(ctx, l.text, maxText);
    ctx.font = "600 11.5px ui-sans-serif, system-ui, sans-serif";
    const nameW = ctx.measureText(l.name).width;
    ctx.font = "500 14px ui-sans-serif, system-ui, sans-serif";
    const textW = Math.max(nameW, ...text.map((t) => ctx.measureText(t).width));
    const h = 30 + text.length * 18;
    return { text, w: textW + face * 2 + 30, h };
  });
  const tops = stackTops(shapes.map((s) => s.h), floor);
  lines.forEach((l, i) => {
    const { text, w, h } = shapes[i];
    // ease to its place in the stack, so the older lines slide up
    l.y = l.y === null ? tops[i] + 8 : l.y + (tops[i] - l.y) * 0.22;
    const y = l.y;
    const a = avatars.find((x) => x.id === l.from);
    const c = a ? characters.get(a.character) : undefined;
    // where they are now; someone who walked out of the room: where they were
    if (a && c) l.x = headOnScreen(c, a, scene, cam, view)[0];
    const sx = l.x;
    const { x, side } = placeBalloon(sx, w, view.width);
    const fresh = Math.min(1, (now - l.at) / 180);
    const under = Math.max(0, Math.min(1, 1 - (top - y) / 36));
    if (under <= 0) return;
    ctx.globalAlpha = lineAlpha(l, now) * fresh * under;
    ctx.shadowColor = "rgba(43,29,24,0.18)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    roundRect(ctx, x, y, w, h, 16);
    ctx.fillStyle = "rgba(255,255,255,0.97)";
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    // a small arrow to whoever said it, when they are out of view
    if (side) {
      const ay = y + h / 2;
      ctx.beginPath();
      if (side === "left") {
        ctx.moveTo(x - 7, ay);
        ctx.lineTo(x + 1, ay - 7);
        ctx.lineTo(x + 1, ay + 7);
      } else {
        ctx.moveTo(x + w + 7, ay);
        ctx.lineTo(x + w - 1, ay - 7);
        ctx.lineTo(x + w - 1, ay + 7);
      }
      ctx.closePath();
      ctx.fill();
    }
    const fx = x + 10 + face, fy = y + 8 + face;
    if (c) drawFace(ctx, c, fx, fy, face);
    else {
      ctx.fillStyle = "#f6ece4";
      ctx.beginPath();
      ctx.arc(fx, fy, face, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2b1d18";
      ctx.font = "600 12px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(l.name.slice(0, 1).toUpperCase(), fx, fy + 1);
    }
    ctx.textAlign = "left";
    const tx = x + 10 + face * 2 + 8;
    ctx.fillStyle = "#8a7468";
    ctx.font = "600 11.5px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(l.name, tx, y + 15);
    ctx.fillStyle = "#2b1d18";
    ctx.font = "500 14px ui-sans-serif, system-ui, sans-serif";
    text.forEach((t, n) => ctx.fillText(t, tx, y + 33 + n * 18));
    ctx.textAlign = "center";
    ctx.globalAlpha = 1;
  });
}

/** Trained today: a soft warm glow behind the character, gently breathing. */
function drawGlow(ctx: CanvasRenderingContext2D, a: Avatar, height: number, now: number) {
  const pulse = 0.85 + Math.sin(now / 700) * 0.15;
  const cx = a.feet[0], cy = a.feet[1] - height * 0.32;
  const r = height * 0.42 * pulse;
  const g = ctx.createRadialGradient(cx, cy, r * 0.15, cx, cy, r);
  g.addColorStop(0, "rgba(255, 214, 120, 0.42)");
  g.addColorStop(1, "rgba(255, 214, 120, 0)");
  ctx.save();
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(cx, cy, r * 0.8, r, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A status icon in a small white circle. */
function drawBadge(ctx: CanvasRenderingContext2D, cx: number, cy: number, icon: string) {
  ctx.save();
  ctx.shadowColor = "rgba(43,29,24,0.2)";
  ctx.shadowBlur = 6;
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  ctx.beginPath();
  ctx.arc(cx, cy, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.font = "15px ui-sans-serif, system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(icon, cx, cy + 1);
  ctx.restore();
}

/** A small padlock: a private message, only for the two of you. */
function drawLock(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.save();
  ctx.strokeStyle = "#8a5a2b";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(cx, cy - 2, 3.6, Math.PI, 0);
  ctx.stroke();
  ctx.fillStyle = "#b5803f";
  roundRect(ctx, cx - 5.5, cy - 2, 11, 8.5, 2);
  ctx.fill();
  ctx.restore();
}

/** An envelope in a white circle with the number of unread messages. */
function drawEnvelope(ctx: CanvasRenderingContext2D, cx: number, cy: number, count: number) {
  ctx.save();
  ctx.shadowColor = "rgba(43,29,24,0.2)";
  ctx.shadowBlur = 6;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(cx, cy, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = "#c9573a";
  roundRect(ctx, cx - 7.5, cy - 5, 15, 10.5, 2);
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(cx - 7, cy - 4.3);
  ctx.lineTo(cx, cy + 1);
  ctx.lineTo(cx + 7, cy - 4.3);
  ctx.stroke();
  if (count > 1) {
    const label = count > 9 ? "9+" : String(count);
    ctx.font = "700 10.5px ui-sans-serif, system-ui, sans-serif";
    const w = Math.max(16, ctx.measureText(label).width + 8);
    roundRect(ctx, cx + 6, cy - 16, w, 16, 8);
    ctx.fillStyle = "#2b1d18";
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.fillText(label, cx + 6 + w / 2, cy - 8);
  }
  ctx.restore();
}

/** The avatar under a screen point (CSS pixels), front-most first; for tapping someone. */
export function avatarAt(sx: number, sy: number, avatars: Avatar[], characters: Map<string, LoadedCharacter>, scene: SceneDef, cam: Camera, view: View): Avatar | null {
  const [x, y] = screenToScene(sx, sy, cam, view);
  for (const a of backToFront(avatars).reverse()) {
    const c = characters.get(a.character);
    if (!c) continue;
    const b = characterBox(c, a, characterHeightAt(scene, a.feet[1]));
    // the drawn figure is narrower than its frame
    const inset = b.w * 0.25;
    if (x >= b.x + inset && x <= b.x + b.w - inset && y >= b.y + b.h * 0.15 && y <= b.y + b.h) return a;
  }
  return null;
}

const gridLayers = new WeakMap<Grid, HTMLCanvasElement>();

/** The walking grid drawn once into its own canvas, so the debug view does not redraw thousands of tiles every frame. */
function gridLayer(scene: SceneDef, grid: Grid): HTMLCanvasElement {
  let layer = gridLayers.get(grid);
  if (layer) return layer;
  layer = document.createElement("canvas");
  layer.width = scene.width;
  layer.height = scene.height;
  const ctx = layer.getContext("2d")!;
  ctx.lineWidth = scene.grid.kind === "screen" ? 1 : 2;
  for (let u = 0; u < grid.nu; u++) {
    for (let v = 0; v < grid.nv; v++) {
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
  gridLayers.set(grid, layer);
  return layer;
}

function drawDebug(ctx: CanvasRenderingContext2D, scene: SceneDef, grid: Grid, outlines: Map<string, Path2D>) {
  ctx.save();
  ctx.drawImage(gridLayer(scene, grid), 0, 0);
  ctx.lineWidth = 2;
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
  // foreground parts (armrests, backrests): purple
  ctx.strokeStyle = "#8a3fd1";
  ctx.setLineDash([12, 8]);
  for (const o of scene.occluders) for (const poly of o.foreground ?? []) ctx.stroke(pathOf(poly));
  ctx.setLineDash([]);
  for (const s of scene.seats) drawSeatMarker(ctx, s, false);
  ctx.restore();
}

/** A seat as the placement mode shows it: the hip point, the facing and the walking spot. */
export function drawSeatMarker(ctx: CanvasRenderingContext2D, s: Seat, selected: boolean) {
  ctx.save();
  ctx.lineWidth = 4;
  ctx.strokeStyle = selected ? "#ffffff" : "rgba(255,255,255,0.8)";
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(s.hip[0], s.hip[1]);
  ctx.lineTo(s.approach[0], s.approach[1]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#3f8f4f";
  ctx.beginPath();
  ctx.arc(s.approach[0], s.approach[1], selected ? 16 : 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = selected ? "#d9338a" : "#b52f74";
  ctx.beginPath();
  ctx.arc(s.hip[0], s.hip[1], selected ? 20 : 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // facing arrow
  const dir = s.facing === "left" ? -1 : 1;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(s.hip[0] + dir * 46, s.hip[1]);
  ctx.lineTo(s.hip[0] + dir * 26, s.hip[1] - 12);
  ctx.lineTo(s.hip[0] + dir * 26, s.hip[1] + 12);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
