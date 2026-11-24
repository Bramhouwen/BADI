/**
 * A pet that lives in someone's room: it wanders to a free place on the floor,
 * then stands, sits, lies down or sleeps there for a while, and walks on.
 * Every phone runs its own pet, so it does not need the live link. Pure
 * bookkeeping; the canvas finds the routes and the renderer draws the frames.
 */
import type { Pt } from "./geometry";

export type PetPose = "lopen" | "staan" | "zitten" | "liggen" | "slapen";

export interface PetDef {
  /** Folder in public/wereld/dieren. */
  key: string;
  name: string;
  /** Frames per pose, `<pose>-01.png` …; walking loops at `walkFps`. */
  frames: Record<PetPose, number>;
  walkFps: number;
  /** Height of the standing dog in room pixels (a standing person is 340). */
  height: number;
  /** Frame size in its pictures, and where the feet are (bottom centre). */
  frameWidth: number;
  frameHeight: number;
  feetY: number;
  /** The pictures face right. */
  facesRight: boolean;
}

export const DOG: PetDef = { key: "hond", name: "Hond", frames: { lopen: 4, staan: 1, zitten: 1, liggen: 1, slapen: 1 }, walkFps: 7, height: 177, frameWidth: 360, frameHeight: 240, feetY: 232, facesRight: true };

/** Who has a pet in their room, by character key. */
export const PETS: Record<string, PetDef> = { daphne: DOG };

/** Walking speed in room pixels per second: a calm trot. */
export const PET_SPEED = 140;

export interface Pet {
  feet: Pt;
  /** Points still to walk to. */
  path: Pt[];
  pose: PetPose;
  facing: "left" | "right";
  /** When the pose started (for the walking frames). */
  since: number;
  /** Stays in this pose until then, then walks on. */
  until: number;
}

export function newPet(feet: Pt, now: number, rand: () => number = Math.random): Pet {
  return { feet, path: [], pose: "slapen", facing: rand() < 0.5 ? "left" : "right", since: now, until: now + 2000 + rand() * 6000 };
}

/** What it does when it arrives, and for how long (ms). */
export function restPose(rand: () => number = Math.random): { pose: PetPose; ms: number } {
  const r = rand();
  if (r < 0.25) return { pose: "staan", ms: 3000 + rand() * 4000 };
  if (r < 0.6) return { pose: "zitten", ms: 5000 + rand() * 7000 };
  if (r < 0.85) return { pose: "liggen", ms: 8000 + rand() * 10000 };
  return { pose: "slapen", ms: 15000 + rand() * 20000 };
}

/**
 * One frame: walk along the path, or rest. When resting is over, `route`
 * gives the way to a new place (null: nowhere to go now, rest a bit longer).
 */
export function stepPet(pet: Pet, dt: number, now: number, route: () => Pt[] | null, rand: () => number = Math.random) {
  if (pet.path.length) {
    let left = PET_SPEED * dt;
    while (left > 0 && pet.path.length) {
      const [tx, ty] = pet.path[0];
      const dx = tx - pet.feet[0], dy = ty - pet.feet[1];
      const d = Math.hypot(dx, dy);
      if (Math.abs(dx) > 1) pet.facing = dx < 0 ? "left" : "right";
      if (d <= left) {
        pet.feet = [tx, ty];
        pet.path.shift();
        left -= d;
      } else {
        pet.feet = [pet.feet[0] + (dx / d) * left, pet.feet[1] + (dy / d) * left];
        left = 0;
      }
    }
    if (!pet.path.length) {
      const next = restPose(rand);
      pet.pose = next.pose;
      pet.since = now;
      pet.until = now + next.ms;
    }
    return;
  }
  if (now < pet.until) return;
  const path = route();
  if (!path?.length) {
    pet.until = now + 3000;
    return;
  }
  pet.path = path;
  pet.pose = "lopen";
  pet.since = now;
}

/** The frame to show: a number from 1. */
export function petFrame(def: PetDef, pet: Pet, now: number): number {
  const n = def.frames[pet.pose];
  if (n <= 1) return 1;
  return (Math.floor(((now - pet.since) / 1000) * def.walkFps) % n) + 1;
}
