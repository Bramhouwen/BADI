/**
 * The invisible walking grid over a drawn background. Rooms use tiles along
 * the drawn floor diamond: tile (u, v) runs from the back corner along the
 * right wall (u) and along the left wall (v). Outside uses square cells
 * aligned with the screen: (u, v) is column and row.
 */
import { pointInPolygon, type Polygon, type Pt } from "./geometry";
import type { SceneDef } from "./scene";

export interface Grid {
  /** Tiles along u and along v. */
  nu: number;
  nv: number;
  walk: boolean[][];
  tileToPx(u: number, v: number): Pt;
  pxToTile(p: Pt): [number, number];
  /** Integer tile under a pixel, or null outside the grid. */
  tileAt(p: Pt): [number, number] | null;
  isWalkable(u: number, v: number): boolean;
  nearestWalkable(p: Pt): [number, number] | null;
}

/** The floor areas of a scene: one, or several (the floors of the house and the stairs between them). */
export function walkableAreas(scene: Pick<SceneDef, "walkable">): Polygon[] {
  const w = scene.walkable;
  return w.length && Array.isArray(w[0][0]) ? (w as Polygon[]) : [w as Polygon];
}

export function buildGrid(scene: SceneDef): Grid {
  let nu: number, nv: number;
  let tileToPx: (u: number, v: number) => Pt;
  let pxToTile: (p: Pt) => [number, number];
  if (scene.grid.kind === "iso") {
    const { top, right, left } = scene.grid.floor;
    nu = nv = scene.grid.tiles;
    const n = scene.grid.tiles;
    const ex: Pt = [(right[0] - top[0]) / n, (right[1] - top[1]) / n];
    const ey: Pt = [(left[0] - top[0]) / n, (left[1] - top[1]) / n];
    const det = ex[0] * ey[1] - ex[1] * ey[0];
    tileToPx = (u, v) => [top[0] + u * ex[0] + v * ey[0], top[1] + u * ex[1] + v * ey[1]];
    pxToTile = ([x, y]) => {
      const dx = x - top[0], dy = y - top[1];
      return [(dx * ey[1] - dy * ey[0]) / det, (ex[0] * dy - ex[1] * dx) / det];
    };
  } else {
    const c = scene.grid.cell;
    nu = Math.ceil(scene.width / c);
    nv = Math.ceil(scene.height / c);
    tileToPx = (u, v) => [u * c, v * c];
    pxToTile = ([x, y]) => [x / c, y / c];
  }
  const walk: boolean[][] = [];
  for (let u = 0; u < nu; u++) {
    const row: boolean[] = [];
    for (let v = 0; v < nv; v++) {
      const c = tileToPx(u + 0.5, v + 0.5);
      row.push(walkableAreas(scene).some((a) => pointInPolygon(c, a)) && !scene.blockers.some((b) => pointInPolygon(c, b)));
    }
    walk.push(row);
  }
  const isWalkable = (u: number, v: number) => u >= 0 && v >= 0 && u < nu && v < nv && walk[u][v];
  const tileAt = (p: Pt): [number, number] | null => {
    const [fu, fv] = pxToTile(p);
    const u = Math.floor(fu), v = Math.floor(fv);
    return u >= 0 && v >= 0 && u < nu && v < nv ? [u, v] : null;
  };
  const nearestWalkable = (p: Pt): [number, number] | null => {
    const [fu, fv] = pxToTile(p);
    let best: [number, number] | null = null;
    let bestD = Infinity;
    for (let u = 0; u < nu; u++) {
      for (let v = 0; v < nv; v++) {
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
  return { nu, nv, walk, tileToPx, pxToTile, tileAt, isWalkable, nearestWalkable };
}
