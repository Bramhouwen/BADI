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
}

export interface Seat {
  id: string;
  label: string;
  /** Where the feet go while sitting. */
  feet: Pt;
  /** A free floor spot to walk to first. */
  approach: Pt;
  facing: "left" | "right";
  /** Occluder the sitter is drawn in front of (the seat itself). */
  sitsOn: string;
  /** Tapping inside this outline means: go sit here. */
  tap: Polygon;
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
