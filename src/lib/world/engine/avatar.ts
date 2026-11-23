/**
 * One character in a scene: where its feet are, the route it walks, and
 * what it is doing. Positions are pixels of the background image.
 */
import { dist, type Pt } from "./geometry";

export type AvatarState = "idle" | "walk" | "sit";

export interface Avatar {
  id: string;
  character: string;
  name: string;
  feet: Pt;
  path: Pt[];
  state: AvatarState;
  /** Animation to play while not walking. */
  pose: string;
  facing: "left" | "right";
  /** Seat id while sitting. */
  seat: string | null;
  /** Furniture not drawn over this avatar while it steps on or off a seat. */
  ignore: string | null;
  /** When the current animation started (performance.now()). */
  since: number;
  /** Called once when the route is done. */
  onArrive: (() => void) | null;
}

/** Walking speed in background pixels per second, matched to the steps of the walk animation. */
export const WALK_SPEED = 230;

export function newAvatar(id: string, character: string, name: string, feet: Pt, now: number): Avatar {
  return { id, character, name, feet, path: [], state: "idle", pose: "staan", facing: "right", seat: null, ignore: null, since: now, onArrive: null };
}

export function walk(a: Avatar, path: Pt[], now: number, onArrive: (() => void) | null = null, ignore: string | null = null) {
  a.path = path.filter((p, i) => i > 0 || dist(p, a.feet) > 2);
  a.seat = null;
  a.ignore = ignore;
  a.onArrive = onArrive;
  if (a.path.length === 0) {
    a.state = "idle";
    onArrive?.();
    a.onArrive = null;
    return;
  }
  if (a.state !== "walk") a.since = now;
  a.state = "walk";
}

/** Moves the avatar along its route. */
export function step(a: Avatar, dt: number, now: number) {
  if (a.state !== "walk") return;
  let left = WALK_SPEED * dt;
  while (left > 0 && a.path.length) {
    const target = a.path[0];
    const d = dist(a.feet, target);
    if (Math.abs(target[0] - a.feet[0]) > 1) a.facing = target[0] < a.feet[0] ? "left" : "right";
    if (d <= left) {
      a.feet = target;
      a.path.shift();
      left -= d;
    } else {
      a.feet = [a.feet[0] + ((target[0] - a.feet[0]) * left) / d, a.feet[1] + ((target[1] - a.feet[1]) * left) / d];
      left = 0;
    }
  }
  if (!a.path.length) {
    a.state = "idle";
    a.pose = "staan";
    a.ignore = null;
    a.since = now;
    const done = a.onArrive;
    a.onArrive = null;
    done?.();
  }
}

export function sit(a: Avatar, seatId: string, feet: Pt, facing: "left" | "right", now: number) {
  a.feet = feet;
  a.path = [];
  a.state = "sit";
  a.pose = "zitten";
  a.seat = seatId;
  a.facing = facing;
  a.since = now;
}

/** The animation to show right now. */
export function animationOf(a: Avatar): string {
  return a.state === "walk" ? "lopen" : a.pose;
}
