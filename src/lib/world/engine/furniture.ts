/**
 * Furniture in a room: where a piece stands on the floor tiles, where its
 * picture goes, whether it fits, and the seat it offers. A piece is placed
 * by its back tile (u, v) and covers `foot` tiles; flipped, it is turned a
 * quarter and its footprint swaps.
 */
import type { Polygon, Pt } from "./geometry";
import type { Grid } from "./grid";
import type { ItemDef } from "../items";

export interface Placement {
  /** Id of the purchase this piece is. */
  id: string;
  item: ItemDef;
  u: number;
  v: number;
  flip: boolean;
}

/** Tiles along u and v, turned when flipped. */
export function footprint(p: Pick<Placement, "item" | "flip">): [number, number] {
  const [a, b] = p.item.foot;
  return p.flip ? [b, a] : [a, b];
}

/** Every tile the piece covers. */
export function coveredTiles(p: Pick<Placement, "item" | "flip" | "u" | "v">): [number, number][] {
  const [a, b] = footprint(p);
  const out: [number, number][] = [];
  for (let i = 0; i < a; i++) for (let j = 0; j < b; j++) out.push([p.u + i, p.v + j]);
  return out;
}

/** The footprint as a polygon in background pixels (back, right, front, left corner). */
export function footprintPolygon(grid: Grid, p: Pick<Placement, "item" | "flip" | "u" | "v">): Polygon {
  const [a, b] = footprint(p);
  return [grid.tileToPx(p.u, p.v), grid.tileToPx(p.u + a, p.v), grid.tileToPx(p.u + a, p.v + b), grid.tileToPx(p.u, p.v + b)];
}

/**
 * Where the bottom centre of the picture goes: in the middle of the
 * footprint, a bit towards its front corner, where the legs stand.
 */
export function basePoint(grid: Grid, p: Pick<Placement, "item" | "flip" | "u" | "v">): Pt {
  const [a, b] = footprint(p);
  const centre = grid.tileToPx(p.u + a / 2, p.v + b / 2);
  const front = grid.tileToPx(p.u + a, p.v + b);
  const k = p.item.flat ? 0.5 : 0.62;
  return [centre[0], centre[1] + (front[1] - centre[1]) * k];
}

/** Drawing order: by the front of the footprint, like characters by their feet. */
export function depthOf(grid: Grid, p: Pick<Placement, "item" | "flip" | "u" | "v">): number {
  const [a, b] = footprint(p);
  return grid.tileToPx(p.u + a, p.v + b)[1] - 1;
}

/** Can the piece stand here: on free floor, not over another piece (rugs may lie under furniture). */
export function fits(grid: Grid, p: Placement, others: readonly Placement[]): boolean {
  const mine = coveredTiles(p);
  if (!mine.every(([u, v]) => grid.isWalkable(u, v))) return false;
  for (const o of others) {
    if (o.id === p.id) continue;
    if (Boolean(o.item.flat) !== Boolean(p.item.flat)) continue;
    const theirs = new Set(coveredTiles(o).map(([u, v]) => `${u},${v}`));
    if (mine.some(([u, v]) => theirs.has(`${u},${v}`))) return false;
  }
  return true;
}

/** The first place where a piece fits, searching from the middle of the room outwards. */
export function freeSpot(grid: Grid, p: Placement, others: readonly Placement[]): { u: number; v: number } | null {
  const cu = Math.floor(grid.nu / 2), cv = Math.floor(grid.nv / 2);
  const spots: [number, number, number][] = [];
  for (let u = 0; u < grid.nu; u++) for (let v = 0; v < grid.nv; v++) spots.push([u, v, Math.hypot(u - cu, v - cv)]);
  spots.sort((x, y) => x[2] - y[2]);
  for (const [u, v] of spots) if (fits(grid, { ...p, u, v }, others)) return { u, v };
  return null;
}

/** The hip point of a seat on a piece, in background pixels. */
export function seatHip(grid: Grid, p: Placement): Pt | null {
  if (!p.item.seat) return null;
  const [bx, by] = basePoint(grid, p);
  return [bx + p.item.seat.dx * p.item.w * (p.flip ? -1 : 1), by - p.item.seat.dy * p.item.h];
}
