/**
 * The camera, like in a game: two zoom levels to switch between (the whole
 * picture, or close to your character), pinching anywhere in between, and
 * while you walk the camera looks ahead in the direction you go.
 */
import type { Pt } from "./geometry";
import type { SceneDef } from "./scene";
import type { View } from "./renderer";

export interface ZoomLevels {
  /** The whole picture on screen: rooms start here, so you see where you can go. */
  overview: number;
  /** Close to your character; outside starts here. */
  close: number;
  /** Never further out than the whole picture, never closer than this. */
  min: number;
  max: number;
}

export function zoomLevels(scene: SceneDef, view: View): ZoomLevels {
  const overview = Math.min(view.width / scene.width, view.height / scene.height);
  const cover = Math.max(view.width / scene.width, view.height / scene.height);
  // The closest zoom keeps a character as large as it can be in the rooms, also outside where characters are drawn smaller.
  const max = Math.max(cover, (1.3 * 340) / scene.characterHeight);
  const close = Math.min(max, Math.max(cover, overview * 1.8) * (scene.camera?.close ?? 1));
  return { overview, close, min: overview, max };
}

export function startZoom(scene: SceneDef, levels: ZoomLevels): number {
  return scene.camera?.start === "close" ? levels.close : levels.overview;
}

/** Double tap: to the other zoom level. */
export function toggledZoom(zoom: number, levels: ZoomLevels): number {
  return zoom < Math.sqrt(levels.overview * levels.close) ? levels.close : levels.overview;
}

/** Unit vector in the direction the character walks, or none while standing. */
export function heading(feet: Pt, next: Pt | undefined): Pt {
  if (!next) return [0, 0];
  const dx = next[0] - feet[0], dy = next[1] - feet[1];
  const d = Math.hypot(dx, dy);
  return d < 1 ? [0, 0] : [dx / d, dy / d];
}

/** Where the camera wants to look: a bit above the feet, and ahead of them by `lead` (a share of the screen). */
export function followTarget(feet: Pt, lead: Pt, scene: SceneDef, view: View, zoom: number): Pt {
  const reach = (Math.min(view.width, view.height) / zoom) * 0.28;
  return [feet[0] + lead[0] * reach, feet[1] - scene.characterHeight * 0.4 + lead[1] * reach];
}

/** Eases a value towards a target: `rate` per second, frame-rate independent. */
export function ease(from: number, to: number, rate: number, dt: number): number {
  return from + (to - from) * (1 - Math.exp(-rate * dt));
}
