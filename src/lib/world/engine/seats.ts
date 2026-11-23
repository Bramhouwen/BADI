/** Seats: hit testing and which piece of furniture you sit on. */
import { dist, pointInPolygon, type Polygon, type Pt } from "./geometry";
import type { Occluder, SceneDef, Seat } from "./scene";

/** The furniture whose outline holds a point (a seat, a spot on a treadmill). */
export function occluderUnder(occluders: readonly Occluder[], p: Pt): string | null {
  return occluders.find((o) => pointInPolygon(p, o.outline))?.id ?? null;
}

/** The furniture whose outline holds the seat: not drawn over the one sitting on it. */
export function seatOccluder(occluders: readonly Occluder[], seat: Seat): string | null {
  if (seat.on !== undefined) return seat.on;
  return occluderUnder(occluders, seat.hip);
}

/** The seat whose hip point is nearest to a tap, within `radius` background pixels. */
export function seatAt(scene: SceneDef, p: Pt, radius = 90): Seat | null {
  let best: Seat | null = null;
  let bestD = radius;
  for (const s of scene.seats) {
    const d = dist(s.hip, p);
    if (d <= bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

/** The parts of the furniture drawn over someone sitting on this seat (armrests, backrests). */
export function seatForeground(occluders: readonly Occluder[], seat: Seat): Polygon[] {
  const id = seatOccluder(occluders, seat);
  return occluders.find((o) => o.id === id)?.foreground ?? [];
}

/** Where a sitting character's frame goes: its zitAnker on the hip point. */
export function sitOrigin(hip: Pt, zitAnker: { x: number; y: number }, scale: number): Pt {
  return [hip[0] - zitAnker.x * scale, hip[1] - zitAnker.y * scale];
}

/** Seats from a <scene>.zitplekken.json file; anything malformed is left out. */
export function readSeats(data: unknown): Seat[] {
  const list = (data as { seats?: unknown })?.seats;
  if (!Array.isArray(list)) return [];
  const pt = (v: unknown): Pt | null => (Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === "number" && Number.isFinite(n)) ? [v[0], v[1]] : null);
  const out: Seat[] = [];
  for (const raw of list) {
    const r = raw as Record<string, unknown>;
    const hip = pt(r.hip);
    const approach = pt(r.approach);
    if (typeof r.id !== "string" || !hip || !approach || (r.facing !== "left" && r.facing !== "right")) continue;
    const seat: Seat = { id: r.id, hip, approach, facing: r.facing };
    if (r.on === null || typeof r.on === "string") seat.on = r.on;
    out.push(seat);
  }
  return out;
}
