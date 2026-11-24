/**
 * Extra spaces you unlock from your own room in World of Badi: bought once
 * with coins, empty at first and furnished like your room. Every space has
 * the shape of the rooms (an edit of the empty room, public/wereld/scenes/
 * ruimte-<id>.webp), so walking, furniture and the door work the same. The
 * prices are also in the database (migration 0033); keep both the same.
 */

export type SpaceId = "badkamer" | "tuin" | "zolder" | "gym";

export interface SpaceDef {
  id: SpaceId;
  name: string;
  price: number;
}

export const SPACES: SpaceDef[] = [
  { id: "badkamer", name: "Badkamer", price: 150 },
  { id: "tuin", name: "Tuin", price: 200 },
  { id: "zolder", name: "Zolder", price: 250 },
  { id: "gym", name: "Eigen gym", price: 300 },
];

export const SPACE_BY_ID = new Map(SPACES.map((s) => [s.id, s]));

/** The shop item you buy to unlock a space. */
export const spaceItem = (id: SpaceId) => `ruimte-${id}`;

export const isSpaceItem = (itemId: string) => itemId.startsWith("ruimte-");

/** Where furniture stands: "kamer" for the room itself, else the space. */
export type RoomArea = "kamer" | SpaceId;

export function isRoomArea(v: string): v is RoomArea {
  return v === "kamer" || SPACE_BY_ID.has(v as SpaceId);
}

export function spaceBackground(id: SpaceId): string {
  return `/wereld/scenes/ruimte-${id}.webp`;
}
