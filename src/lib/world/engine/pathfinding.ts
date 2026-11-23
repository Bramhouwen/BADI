/**
 * Routes over the tile grid: A* with eight directions that never cuts the
 * corner of a blocked tile, then shortened by skipping points you can walk
 * to in a straight line.
 */
import type { Grid } from "./grid";

type Tile = [number, number];

/** A small binary heap of [key, priority], lowest priority first. */
class Heap {
  private k: number[] = [];
  private f: number[] = [];
  get size() {
    return this.k.length;
  }
  push(key: number, pri: number) {
    const { k, f } = this;
    let i = k.length;
    k.push(key);
    f.push(pri);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (f[p] <= f[i]) break;
      [k[p], k[i]] = [k[i], k[p]];
      [f[p], f[i]] = [f[i], f[p]];
      i = p;
    }
  }
  pop(): number {
    const { k, f } = this;
    const top = k[0];
    const lk = k.pop()!, lf = f.pop()!;
    if (k.length) {
      k[0] = lk;
      f[0] = lf;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < k.length && f[l] < f[m]) m = l;
        if (r < k.length && f[r] < f[m]) m = r;
        if (m === i) break;
        [k[m], k[i]] = [k[i], k[m]];
        [f[m], f[i]] = [f[i], f[m]];
        i = m;
      }
    }
    return top;
  }
}

export function findPath(grid: Grid, from: Tile, to: Tile): Tile[] | null {
  const nv = grid.nv;
  if (!grid.isWalkable(to[0], to[1])) return null;
  const key = (u: number, v: number) => u * nv + v;
  const total = grid.nu * nv;
  const g = new Float64Array(total).fill(Infinity);
  const came = new Int32Array(total).fill(-1);
  const closed = new Uint8Array(total);
  const open = new Heap();
  const h = (u: number, v: number) => {
    const du = Math.abs(u - to[0]), dv = Math.abs(v - to[1]);
    return Math.max(du, dv) + (Math.SQRT2 - 1) * Math.min(du, dv);
  };
  const start = key(from[0], from[1]);
  g[start] = 0;
  open.push(start, h(from[0], from[1]));
  while (open.size) {
    const k = open.pop();
    if (closed[k]) continue;
    closed[k] = 1;
    const u = Math.floor(k / nv), v = k % nv;
    if (u === to[0] && v === to[1]) {
      const path: Tile[] = [[u, v]];
      let c = k;
      while (came[c] !== -1) {
        c = came[c];
        path.unshift([Math.floor(c / nv), c % nv]);
      }
      return path;
    }
    for (let du = -1; du <= 1; du++) {
      for (let dv = -1; dv <= 1; dv++) {
        if (!du && !dv) continue;
        const nu = u + du, nvv = v + dv;
        if (!grid.isWalkable(nu, nvv)) continue;
        if (du && dv && (!grid.isWalkable(u + du, v) || !grid.isWalkable(u, v + dv))) continue;
        const nk = key(nu, nvv);
        const cost = g[k] + (du && dv ? Math.SQRT2 : 1);
        if (cost < g[nk]) {
          g[nk] = cost;
          came[nk] = k;
          open.push(nk, cost + h(nu, nvv));
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
