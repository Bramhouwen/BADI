/**
 * Routes over the tile grid: A* with eight directions that never cuts the
 * corner of a blocked tile, then shortened by skipping points you can walk
 * to in a straight line.
 */
import type { Grid } from "./grid";

type Tile = [number, number];

export function findPath(grid: Grid, from: Tile, to: Tile): Tile[] | null {
  const n = grid.n;
  if (!grid.isWalkable(to[0], to[1])) return null;
  const key = (u: number, v: number) => u * n + v;
  const g = new Map<number, number>();
  const came = new Map<number, number>();
  const open: { k: number; f: number }[] = [];
  const h = (u: number, v: number) => {
    const du = Math.abs(u - to[0]), dv = Math.abs(v - to[1]);
    return Math.max(du, dv) + (Math.SQRT2 - 1) * Math.min(du, dv);
  };
  const start = key(from[0], from[1]);
  g.set(start, 0);
  open.push({ k: start, f: h(from[0], from[1]) });
  const closed = new Set<number>();
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const { k } = open.splice(bi, 1)[0];
    if (closed.has(k)) continue;
    closed.add(k);
    const u = Math.floor(k / n), v = k % n;
    if (u === to[0] && v === to[1]) {
      const path: Tile[] = [[u, v]];
      let c = k;
      while (came.has(c)) {
        c = came.get(c)!;
        path.unshift([Math.floor(c / n), c % n]);
      }
      return path;
    }
    for (let du = -1; du <= 1; du++) {
      for (let dv = -1; dv <= 1; dv++) {
        if (!du && !dv) continue;
        const nu = u + du, nv = v + dv;
        if (!grid.isWalkable(nu, nv)) continue;
        if (du && dv && (!grid.isWalkable(u + du, v) || !grid.isWalkable(u, v + dv))) continue;
        const nk = key(nu, nv);
        const cost = (g.get(k) ?? 0) + (du && dv ? Math.SQRT2 : 1);
        if (cost < (g.get(nk) ?? Infinity)) {
          g.set(nk, cost);
          came.set(nk, k);
          open.push({ k: nk, f: cost + h(nu, nv) });
        }
      }
    }
  }
  return null;
}

/** True when every tile along the straight line between two tile centres is walkable. */
export function lineOfSight(grid: Grid, a: Tile, b: Tile): boolean {
  const steps = Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) * 3) || 1;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = a[0] + 0.5 + (b[0] - a[0]) * t;
    const v = a[1] + 0.5 + (b[1] - a[1]) * t;
    // Check the tile and a small margin either side so the line does not graze corners.
    for (const [ou, ov] of [[0, 0], [0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]]) {
      if (!grid.isWalkable(Math.floor(u + ou), Math.floor(v + ov))) return false;
    }
  }
  return true;
}

export function smoothPath(grid: Grid, path: Tile[]): Tile[] {
  if (path.length <= 2) return path;
  const out: Tile[] = [path[0]];
  let i = 0;
  while (i < path.length - 1) {
    let j = path.length - 1;
    while (j > i + 1 && !lineOfSight(grid, path[i], path[j])) j--;
    out.push(path[j]);
    i = j;
  }
  return out;
}
