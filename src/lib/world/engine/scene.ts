/**
 * A scene: one drawn background with an invisible walking grid on top.
 * Everything is in pixels of the background image.
 */
import type { Polygon, Pt } from "./geometry";

export interface Occluder {
  id: string;
  /** Outline of the furniture as drawn; this part of the background is drawn again over characters behind it. */
  outline: Polygon;
  /** The furniture's front edge on the floor, left to right. A character whose feet are above it (smaller y) is behind. */
  front: Polygon;
  /**
   * Parts of this piece that are in front of someone sitting on it, such as
   * an armrest that faces the viewer or the back of a chair seen from behind.
   * Cut from the background and drawn over the one sitting there.
   */
  foreground?: Polygon[];
}

/**
 * A place to sit, set in the placement mode (/wereld?bewerken) and saved in
 * <scene>.zitplekken.json. The character's zitAnker goes exactly on `hip`.
 */
export interface Seat {
  id: string;
  /** Where the hips rest, in background pixels. */
  hip: Pt;
  facing: "left" | "right";
  /** Free floor (a tile centre) to walk to before sitting down. */
  approach: Pt;
}

export interface Door {
  id: string;
  label: string;
  tap: Polygon;
  approach: Pt;
  /** Scene behind the door; null while it does not exist yet. */
  to: string | null;
}

export interface SceneDef {
  id: string;
  name: string;
  background: string;
  width: number;
  height: number;
  /** Corners of the floor diamond: back (top), right, front (bottom), left. */
  floor: { top: Pt; right: Pt; bottom: Pt; left: Pt };
  /** Tiles per side of the floor diamond. */
  tiles: number;
  /** Where characters may stand: tile centres inside it are walkable. */
  walkable: Polygon;
  /** Floor areas taken by furniture. */
  blockers: Polygon[];
  occluders: Occluder[];
  seats: Seat[];
  doors: Door[];
  spawn: Pt;
  /** Drawn height of a standing character (frame height) in image pixels. */
  characterHeight: number;
}
