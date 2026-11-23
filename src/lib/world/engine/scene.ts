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
  /**
   * The furniture you sit on, which is not drawn over you. Left out: the
   * piece whose outline holds the hip point. null: none, for a chair behind a
   * desk or table, where the desk in front is drawn over your legs.
   */
  on?: string | null;
}

export interface Door {
  id: string;
  label: string;
  tap: Polygon;
  /** Free floor in front of the door: where you walk to, and where you come out when you arrive through it. */
  approach: Pt;
  /** Scene behind the door; null while it does not exist yet. */
  to: string | null;
  /** The door in that scene you come out of. */
  arrive?: string;
}

/**
 * A place to do something: run on a treadmill, jump squats on a mat, get a
 * coffee. You walk to `approach`, step onto `at` (your feet) and play `pose`
 * there until you walk away.
 */
export interface Spot {
  id: string;
  label: string;
  /** Tap here to go to the spot. */
  tap: Polygon;
  approach: Pt;
  at: Pt;
  facing: "left" | "right";
  /** Animation from the character's manifest. */
  pose: string;
  /** Besides doing it here, a page in the app for it (the treadmill: log a training). Tapping the spot then asks which. */
  link?: { label: string; href: string };
}

export interface SceneDef {
  id: string;
  name: string;
  background: string;
  width: number;
  height: number;
  /**
   * The walking grid. Rooms: tiles along the drawn floor diamond, given by
   * its corners (back, right, front, left) and the tiles per side. Outside,
   * where nothing is drawn on a clean diagonal: square cells of `cell` pixels.
   */
  grid: { kind: "iso"; floor: { top: Pt; right: Pt; bottom: Pt; left: Pt }; tiles: number } | { kind: "screen"; cell: number };
  /** Where characters may stand: tile centres inside it are walkable. */
  walkable: Polygon;
  /** Floor areas taken by furniture. */
  blockers: Polygon[];
  occluders: Occluder[];
  seats: Seat[];
  doors: Door[];
  spots: Spot[];
  spawn: Pt;
  /** Drawn height of a standing character (frame height) in image pixels. */
  characterHeight: number;
  /** Walking speed in background pixels per second, so steps match the walk animation at this size. */
  walkSpeed?: number;
  /**
   * Camera. `start`: the whole picture (rooms, the default) or close to your
   * character (outside, where the picture is too large for one screen).
   * `close`: how much closer the close-up zoom is than usual.
   */
  camera?: { start?: "overview" | "close"; close?: number };
}
