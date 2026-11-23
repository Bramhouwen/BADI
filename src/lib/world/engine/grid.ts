/**
 * The invisible tile grid over a drawn floor. Tile (u, v) runs from the back
 * corner along the right wall (u) and along the left wall (v).
 */
import { pointInPolygon, type Pt } from "./geometry";
import type { SceneDef } from "./scene";

export interface Grid {
  n: number;
  walk: boolean[][];
  tileToPx(u: number, v: number): Pt;
  pxToTile(p: Pt): [number, number];
  /** Integer tile under a pixel, or null outside the floor. */
  tileAt(p: Pt): [number, number] | null;
  isWalkable(u: number, v: number): boolean;
  nearestWalkable(p: Pt): [number, number] | null;
}

export function buildGrid(scene: SceneDef): Grid {
  const { top, right, left } = scene.floor;
  const n = scene.tiles;
  const ex: Pt = [(right[0] - top[0]) / n, (right[1] - top[1]) / n];
  const ey: Pt = [(left[0] - top[0]) / n, (left[1] - top[1]) / n];
  const det = ex[0] * ey[1] - ex[1] * ey[0];
  const tileToPx = (u: number, v: number): Pt => [top[0] + u * ex[0] + v * ey[0], top[1] + u * ex[1] + v * ey[1]];
  const pxToTile = ([x, y]: Pt): [number, number] => {
    const dx = x - top[0], dy = y - top[1];
    return [(dx * ey[1] - dy * ey[0]) / det, (ex[0] * dy - ex[1] * dx) / det];
  };
  const walk: boolean[][] = [];
  for (let u = 0; u < n; u++) {
    const row: boolean[] = [];
    for (let v = 0; v < n; v++) {
      const c = tileToPx(u + 0.5, v + 0.5);
      row.push(pointInPolygon(c, scene.walkable) && !scene.blockers.some((b) => pointInPolygon(c, b)));
    }
    walk.push(row);
  }
  const isWalkable = (u: number, v: number) => u >= 0 && v >= 0 && u < n && v < n && walk[u][v];
  const tileAt = (p: Pt): [number, number] | null => {
    const [fu, fv] = pxToTile(p);
    const u = Math.floor(fu), v = Math.floor(fv);
    return u >= 0 && v >= 0 && u < n && v < n ? [u, v] : null;
  };
  const nearestWalkable = (p: Pt): [number, number] | null => {
    const [fu, fv] = pxToTile(p);
    let best: [number, number] | null = null;
    let bestD = Infinity;
    for (let u = 0; u < n; u++) {
      for (let v = 0; v < n; v++) {
        if (!walk[u][v]) continue;
        const d = (u + 0.5 - fu) ** 2 + (v + 0.5 - fv) ** 2;
        if (d < bestD) {
          bestD = d;
          best = [u, v];
        }
      }
    }
    return best;
  };
  return { n, walk, tileToPx, pxToTile, tileAt, isWalkable, nearestWalkable };
}
