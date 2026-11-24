/**
 * The conversation strip at the top of the world: what is said in the room
 * appears there as a balloon above the one who said it, always the same size
 * whatever the zoom. A new line comes in at the bottom of the strip and
 * pushes the older ones up, until they fade out. Pure bookkeeping; the
 * renderer draws it.
 */

/** How long a line stays in the strip. */
export const CHAT_LINE_SECONDS = 15;
/** At most this many lines in the strip; the oldest goes first. */
export const CHAT_MAX_LINES = 5;
/** Fading out at the end, in ms. */
export const CHAT_FADE_MS = 600;

export interface ChatLine {
  id: number;
  /** User id of whoever said it. */
  from: string;
  name: string;
  text: string;
  /** performance.now() when it came in. */
  at: number;
  /** Screen x of the speaker when it came in, for when they are not in view any more. */
  x: number | null;
  /** Where it is drawn now, in CSS pixels from the top of the strip; eases to its place. */
  y: number | null;
}

/** Adds a line, keeping the newest `max`. */
export function pushLine(lines: readonly ChatLine[], line: ChatLine, max = CHAT_MAX_LINES): ChatLine[] {
  return [...lines, line].slice(-max);
}

/** The lines still to show at `now`. */
export function liveLines(lines: readonly ChatLine[], now: number, seconds = CHAT_LINE_SECONDS): ChatLine[] {
  return lines.filter((l) => now - l.at < seconds * 1000);
}

/** How opaque a line is: 1, fading out over the last moments. */
export function lineAlpha(line: ChatLine, now: number, seconds = CHAT_LINE_SECONDS): number {
  const left = seconds * 1000 - (now - line.at);
  return Math.max(0, Math.min(1, left / CHAT_FADE_MS));
}

/**
 * Where each line goes, top edge in pixels from the top of the strip: the
 * newest at the bottom (`floor`), every older one above it.
 */
export function stackTops(heights: readonly number[], floor: number, gap = 6): number[] {
  const tops = new Array<number>(heights.length);
  let bottom = floor;
  for (let i = heights.length - 1; i >= 0; i--) {
    tops[i] = bottom - heights[i];
    bottom = tops[i] - gap;
  }
  return tops;
}

/**
 * Where a balloon of width `w` goes for a speaker at screen x `sx`: centred
 * over them, kept on screen. `side` says the speaker is out of view to the
 * left or right, for a small arrow.
 */
export function placeBalloon(sx: number | null, w: number, viewWidth: number, margin = 10): { x: number; side: "left" | "right" | null } {
  const centre = sx ?? viewWidth / 2;
  const x = Math.max(margin, Math.min(viewWidth - w - margin, centre - w / 2));
  const side = sx === null ? null : sx < 0 ? "left" : sx > viewWidth ? "right" : null;
  return { x, side };
}
