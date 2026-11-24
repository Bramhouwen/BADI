/**
 * Animated squad characters. Each member with a sheet in public/sprites gets
 * their own character; members without one keep their profile photo.
 * Make a sheet with `npm run sprite -- <file> <name>` and add the name here.
 */
import { isDemo } from "./demo";

export const SPRITE_CELL = { w: 320, h: 272, cols: 6, rows: 4 } as const;

export type SpriteAnim = "walk" | "happy" | "squat" | "wave" | "cheer" | "sit" | "sleep" | "stand";

type Frames = { frames: readonly (readonly [number, number])[]; fps: number };

/** Frames as [row, column] in the sheet, and the speed in frames per second, for Anne's layout. */
export const SPRITE_ANIMS: Record<SpriteAnim, Frames> = {
  walk: { frames: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5]], fps: 8 },
  happy: { frames: [[1, 0], [1, 1], [1, 2], [1, 3], [1, 4], [1, 5]], fps: 7 },
  squat: { frames: [[2, 0], [2, 1], [2, 2], [2, 3], [2, 4], [2, 5]], fps: 7 },
  wave: { frames: [[3, 0], [3, 1]], fps: 2.5 },
  cheer: { frames: [[3, 5], [2, 3]], fps: 3 },
  sit: { frames: [[3, 2], [3, 3]], fps: 1 },
  sleep: { frames: [[3, 4]], fps: 1 },
  stand: { frames: [[3, 0]], fps: 1 },
};

/**
 * Bram's sheet: row 1 walk, row 2 squat jump with cheering, row 3 stand and
 * wave, row 4 stand, then sitting and lying back in a chair.
 */
const BRAM_ANIMS: Record<SpriteAnim, Frames> = {
  walk: { frames: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5]], fps: 8 },
  happy: { frames: [[1, 1], [1, 2], [1, 3], [1, 2]], fps: 6 },
  squat: { frames: [[1, 0], [1, 1], [1, 2], [1, 3], [1, 4], [1, 5]], fps: 7 },
  wave: { frames: [[2, 1], [2, 2], [2, 3], [2, 2]], fps: 4 },
  cheer: { frames: [[1, 3], [1, 2]], fps: 3 },
  sit: { frames: [[3, 1], [3, 2]], fps: 1 },
  sleep: { frames: [[3, 4], [3, 5]], fps: 0.7 },
  stand: { frames: [[2, 0]], fps: 1 },
};

export interface SpriteSheet {
  src: string;
  /** Head on a cream square, for push notifications. */
  face: string;
  /** False while the character is ready but not released to its member yet. */
  live?: boolean;
  anims: Record<SpriteAnim, Frames>;
}

/** Sheets by lower-case first name. */
export const SPRITE_SHEETS: Record<string, SpriteSheet> = {
  anne: { src: "/sprites/anne.webp", face: "/sprites/anne-face.png", anims: SPRITE_ANIMS },
  irene: { src: "/sprites/irene.webp", face: "/sprites/irene-face.png", anims: SPRITE_ANIMS, live: false },
  daphne: { src: "/sprites/daphne.webp", face: "/sprites/daphne-face.png", anims: SPRITE_ANIMS, live: false },
  bram: { src: "/sprites/bram.webp", face: "/sprites/bram-face.png", anims: BRAM_ANIMS, live: false },
};

/** The key of a member's character: their lower-case first name. */
export function spriteKey(displayName: string | null | undefined): string {
  return (displayName ?? "").trim().split(/\s+/)[0]?.toLowerCase() ?? "";
}

/**
 * Master switch for the characters in the app (welcome, buddy card,
 * celebrations, characters with messages, faces in push notifications, the
 * announcement). Off: nobody sees them, nothing is deleted, and the admin
 * cannot release or announce them; set to true to bring everything back.
 * World of Badi has its own characters and is not affected.
 */
export const SPRITES_LIVE = false;

/**
 * The sheet of a member, or null. A character is live when the code says so
 * or when the admin released it (`released`, from the database). In demo mode
 * everyone borrows the first sheet.
 */
export function sheetFor(displayName: string | null | undefined, released: ReadonlySet<string> = new Set()): SpriteSheet | null {
  if (!SPRITES_LIVE) return null;
  const key = spriteKey(displayName);
  const sheet = SPRITE_SHEETS[key];
  if (sheet && (sheet.live !== false || released.has(key))) return sheet;
  if (isDemo()) return Object.values(SPRITE_SHEETS)[0] ?? null;
  return null;
}

/** Characters that are ready but wait for the admin to release them. */
export function unreleasedKeys(): string[] {
  return Object.entries(SPRITE_SHEETS)
    .filter(([, s]) => s.live === false)
    .map(([k]) => k);
}
