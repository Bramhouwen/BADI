/**
 * Everyone's own room in the BADI house: the same empty room in four colours
 * (public/wereld/scenes/kamer-<kleur>.webp, made from the living room by
 * leaving out all furniture), furnished by the one who lives there. Measured
 * once on kamer-groen.webp (2000 x 1493); the four share the same shape.
 */
import type { SceneDef } from "../engine/scene";

/** Which room colour belongs to which character. */
export const ROOM_COLOURS: Record<string, string> = { bram: "groen", anne: "perzik", daphne: "blauw", irene: "lila" };

const NAMES: Record<string, string> = { bram: "Bram", anne: "Anne", daphne: "Daphne", irene: "Irene" };

export function roomId(character: string): string {
  return `kamer-${character}`;
}

function room(character: string): SceneDef {
  return {
    id: roomId(character),
    name: `Kamer van ${NAMES[character] ?? character}`,
    background: `/wereld/scenes/kamer-${ROOM_COLOURS[character]}.webp`,
    width: 2000,
    height: 1493,
    grid: { kind: "iso", floor: { top: [1000, 570], right: [1965, 945], bottom: [1000, 1480], left: [35, 950] }, tiles: 12 },
    walkable: [[1000, 598], [1912, 946], [1000, 1452], [88, 950]],
    blockers: [],
    occluders: [],
    seats: [],
    doors: [{ id: "deur", label: "Naar de woonkamer", tap: [[60, 500], [212, 452], [216, 880], [70, 946]], approach: [228, 948], to: "woonkamer", arrive: "voordeur" }],
    spots: [],
    spawn: [300, 975],
    characterHeight: 340,
    owner: character,
  };
}

export const ROOMS: SceneDef[] = Object.keys(ROOM_COLOURS).map(room);
