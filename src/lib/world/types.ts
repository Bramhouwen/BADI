/** BADI Wereld: shared types and small pure helpers. See docs/wereld/WERELD.md. */

/**
 * While false, only the admin sees BADI Wereld (the map icon and /wereld), so
 * the world can be built and tested in the live app. Set to true to open it
 * for the whole squad.
 */
export const WORLD_OPEN = false;

/** Whether this member may see the world yet. */
export function canSeeWorld(role: string | null | undefined): boolean {
  return WORLD_OPEN || role === "admin";
}

/** Scenes with a drawn background in public/wereld/scenes. */
export const WORLD_SCENES = ["buiten", "woonkamer", "kantoor", "sportschool"] as const;
export type WorldScene = (typeof WORLD_SCENES)[number];

/** Characters with frames and a manifest in public/wereld/poppetjes. */
export const WORLD_SPRITES = ["anne", "daphne", "irene", "bram"] as const;

export interface WorldProfile {
  user_id: string;
  challenge_id: string;
  /** Folder in public/wereld/poppetjes, or null when the member has no character yet. */
  sprite: string | null;
  scene: string;
  x: number | null;
  y: number | null;
  updated_at: string;
}

/** Manifest of one character (public/wereld/poppetjes/<naam>/manifest.json). */
export interface SpriteManifest {
  name: string;
  frameWidth: number;
  frameHeight: number;
  mirrorForLeft: boolean;
  animations: Record<string, { frames: string[]; fps: number; loop: boolean; anchor: { x: number; y: number }; withChair?: boolean }>;
}

/** The character of a member by display name: their lower-case first name, when it exists. */
export function worldSpriteFor(displayName: string | null | undefined): string | null {
  const key = (displayName ?? "").trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  return (WORLD_SPRITES as readonly string[]).includes(key) ? key : null;
}

/** A new member starts outside, without a position (the world picks the entrance). */
export function newWorldProfile(userId: string, challengeId: string, displayName: string | null | undefined): Omit<WorldProfile, "updated_at"> {
  return { user_id: userId, challenge_id: challengeId, sprite: worldSpriteFor(displayName), scene: "buiten", x: null, y: null };
}
