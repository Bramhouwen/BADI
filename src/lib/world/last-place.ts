/**
 * Where someone in the world ends up: the end of what they were doing (the
 * seat, the spot, or where they walked to). Used to keep people where they
 * were, offline, after they leave the world.
 */
import { SCENES } from "./scenes";
import type { WorldPresence } from "./engine/presence";

export interface LastPlace {
  scene: string;
  x: number;
  y: number;
  activity: string | null;
}

export function lastPlaceOf(p: Pick<WorldPresence, "scene" | "intent" | "from">): LastPlace | null {
  const scene = SCENES[p.scene];
  if (!scene) return null;
  const i = p.intent;
  if (i?.kind === "seat") {
    const seat = scene.seats.find((s) => s.id === i.id);
    if (seat) return { scene: p.scene, x: seat.hip[0], y: seat.hip[1], activity: seat.id };
  }
  if (i?.kind === "spot") {
    const spot = scene.spots.find((s) => s.id === i.id);
    if (spot) return { scene: p.scene, x: spot.at[0], y: spot.at[1], activity: spot.id };
  }
  const at = i?.kind === "stand" ? i.to : p.from;
  return { scene: p.scene, x: at[0], y: at[1], activity: null };
}
