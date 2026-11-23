/**
 * Depth on a drawn background: furniture is part of the image, so a character
 * behind a piece of furniture gets that piece drawn again on top of it.
 */
import { bbox, polylineYAt, type Pt } from "./geometry";
import type { Occluder } from "./scene";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** The furniture to draw over a character standing with its feet at `feet` and covering `box`. */
export function occludersOver(feet: Pt, box: Box, occluders: readonly Occluder[], exclude: string | null = null): Occluder[] {
  return occluders.filter((o) => o.id !== exclude && feet[1] < polylineYAt(o.front, feet[0]) && overlaps(box, bbox(o.outline)));
}

/** Characters are drawn from back to front: smaller feet y first. */
export function backToFront<T extends { feet: Pt }>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => a.feet[1] - b.feet[1]);
}
