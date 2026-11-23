/**
 * Moving a character on purpose: walk to a point, sit on a seat, or do
 * something at a spot. The same code plays your own taps and the moves of
 * the others, which arrive as an intent ("from here, to seat zit-2") so every
 * phone works out the route itself.
 */
import { act, sit, step, walk, type Avatar } from "./avatar";
import type { Pt } from "./geometry";
import type { Grid } from "./grid";
import { findPath, smoothPath } from "./pathfinding";
import type { SceneDef } from "./scene";
import { occluderUnder, seatOccluder } from "./seats";

export type Intent = { kind: "stand"; to: Pt } | { kind: "seat"; id: string } | { kind: "spot"; id: string };

/** The route from one point to another in background pixels, ending exactly on the target when it is free floor. */
export function routeTo(grid: Grid, from: Pt, to: Pt): Pt[] | null {
  const startTile = grid.tileAt(from);
  const start = startTile && grid.isWalkable(...startTile) ? startTile : grid.nearestWalkable(from);
  const goalTile = grid.tileAt(to);
  const exact = Boolean(goalTile && grid.isWalkable(...goalTile));
  const goal = exact ? goalTile : grid.nearestWalkable(to);
  if (!start || !goal) return null;
  const tiles = findPath(grid, start, goal);
  if (!tiles) return null;
  const pts = smoothPath(grid, tiles).map(([u, v]) => grid.tileToPx(u + 0.5, v + 0.5));
  if (exact) pts[pts.length - 1] = to;
  return pts;
}

/** What a character can do: some have no pose for a spot, or sit only in their own chair. */
export interface Abilities {
  canSit: boolean;
  has(pose: string): boolean;
}

export type MoveResult = "ok" | "unreachable" | "cannot";

/**
 * Starts a move. Standing up from a seat or stepping off a spot keeps that
 * piece from being drawn over you while you step away. `done` runs when the
 * character has arrived (and sat down or started).
 */
export function startIntent(a: Avatar, scene: SceneDef, grid: Grid, intent: Intent, now: number, can: Abilities, done?: () => void): MoveResult {
  const seatNow = a.state === "sit" ? scene.seats.find((s) => s.id === a.seat) : null;
  const spotNow = a.state === "act" ? scene.spots.find((s) => s.id === a.spot) : null;
  const leaving = seatNow ? seatOccluder(scene.occluders, seatNow) : spotNow ? occluderUnder(scene.occluders, spotNow.at) : null;

  if (intent.kind === "stand") {
    const route = routeTo(grid, a.feet, intent.to);
    if (!route) return "unreachable";
    if (a.state === "sit" || a.state === "act") a.state = "idle";
    walk(a, route, now, done ?? null, leaving);
    return "ok";
  }
  if (intent.kind === "seat") {
    const seat = scene.seats.find((s) => s.id === intent.id);
    if (!seat) return "unreachable";
    if (!can.canSit) return "cannot";
    const route = routeTo(grid, a.feet, seat.approach);
    if (!route) return "unreachable";
    if (a.state === "sit" || a.state === "act") a.state = "idle";
    walk(
      a,
      route,
      now,
      () => {
        walk(a, [seat.hip], now, () => {
          sit(a, seat.id, seat.hip, seat.facing, a.since);
          done?.();
        }, seatOccluder(scene.occluders, seat));
      },
      leaving,
    );
    return "ok";
  }
  const spot = scene.spots.find((s) => s.id === intent.id);
  if (!spot) return "unreachable";
  if (!can.has(spot.pose)) return "cannot";
  const route = routeTo(grid, a.feet, spot.approach);
  if (!route) return "unreachable";
  if (a.state === "sit" || a.state === "act") a.state = "idle";
  walk(
    a,
    route,
    now,
    () => {
      walk(a, [spot.at], now, () => {
        act(a, spot.id, spot.at, spot.facing, spot.pose, a.since);
        done?.();
      }, occluderUnder(scene.occluders, spot.at));
    },
    leaving,
  );
  return "ok";
}

/** Puts a character straight where a move ends, without walking: someone already there when you arrive. */
export function placeAtEnd(a: Avatar, scene: SceneDef, intent: Intent, now: number, can: Abilities) {
  a.path = [];
  a.onArrive = null;
  a.ignore = null;
  if (intent.kind === "seat") {
    const seat = scene.seats.find((s) => s.id === intent.id);
    if (seat && can.canSit) return sit(a, seat.id, seat.hip, seat.facing, now);
    if (seat) a.feet = seat.approach;
  } else if (intent.kind === "spot") {
    const spot = scene.spots.find((s) => s.id === intent.id);
    if (spot && can.has(spot.pose)) return act(a, spot.id, spot.at, spot.facing, spot.pose, now);
    if (spot) a.feet = spot.approach;
  } else {
    a.feet = intent.to;
  }
  a.state = "idle";
  a.pose = "staan";
  a.seat = null;
  a.spot = null;
  a.since = now;
}

/**
 * Plays a move forward by `seconds` at once: someone who started walking
 * before you came in is shown where they are now, not at the start.
 */
export function fastForward(a: Avatar, seconds: number, now: number) {
  let left = Math.max(0, Math.min(seconds, 120));
  while (left > 0 && a.state === "walk") {
    const dt = Math.min(left, 0.25);
    step(a, dt, now);
    left -= dt;
  }
}
