/**
 * The Weekrad in the back garden of World of Badi: four squares in front of
 * the wheel. The wheel opens once everyone of the group stands in a square;
 * then you spin one after the other, by square, and everyone watches. Who
 * already spun this week only watches. Pure rules; the view and the canvas
 * use them.
 */

/** The squares in front of the wheel, left to right: the order of the turns. */
export const WHEEL_SQUARES = ["vak-1", "vak-2", "vak-3", "vak-4"] as const;
export const WHEEL_SCENE = "achtertuin";

export function isSquare(spot: string | null | undefined): boolean {
  return Boolean(spot && (WHEEL_SQUARES as readonly string[]).includes(spot));
}

export interface RingState {
  /** Everyone stands in a square. */
  complete: boolean;
  /** Members not in a square yet. */
  missing: string[];
  /** Who stands in which square, in turn order. */
  order: { id: string; square: string }[];
  /** Whose turn it is: the first in square order that did not spin this week; null when not complete or all spun. */
  turn: string | null;
  /** Everyone spun this week. */
  done: boolean;
}

/**
 * `members`: everyone of the group who has a character. `standing`: user id
 * to the square they stand in (in the back garden, now). `spun`: who spun
 * this week.
 */
export function ringState(members: readonly string[], standing: ReadonlyMap<string, string>, spun: ReadonlySet<string>): RingState {
  const order = [...standing.entries()]
    .filter(([id, sq]) => members.includes(id) && isSquare(sq))
    .sort((a, b) => WHEEL_SQUARES.indexOf(a[1] as (typeof WHEEL_SQUARES)[number]) - WHEEL_SQUARES.indexOf(b[1] as (typeof WHEEL_SQUARES)[number]))
    .map(([id, square]) => ({ id, square }));
  const missing = members.filter((id) => !order.some((o) => o.id === id));
  const complete = members.length > 0 && missing.length === 0;
  const done = members.length > 0 && members.every((id) => spun.has(id));
  const turn = complete ? (order.find((o) => !spun.has(o.id))?.id ?? null) : null;
  return { complete, missing, order, turn, done };
}

/** A shared random number for where the wheel lands, the same on every phone. */
export function landingSeed(): number {
  return Math.round(Math.random() * 1_000_000) / 1_000_000;
}

/** How long the wheel turns, as on the Weekrad page. */
export const WHEEL_SPIN_MS = 5200;

/** Ease-out like the page's cubic-bezier(0.12, 0.8, 0.14, 1): fast start, long slow stop. */
export function wheelEase(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - x, 4);
}
