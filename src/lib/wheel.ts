/**
 * Weekrad: categories, odds, the extra week challenges and timing. Pure
 * helpers shared by the wheel, the prize cabinet, the admin and tests. The
 * outcome itself is decided in the database (spin_wheel, migration 0024).
 */
import { addDays, type DateKey } from "./dates";

export const WHEEL_CATEGORIES = ["food", "hydration", "sport", "voucher", "challenge"] as const;
export type WheelCategory = (typeof WHEEL_CATEGORIES)[number];
export type PrizeCategory = Exclude<WheelCategory, "challenge">;
export const PRIZE_CATEGORIES = WHEEL_CATEGORIES.filter((c): c is PrizeCategory => c !== "challenge");

export const CATEGORY_META: Record<WheelCategory, { label: string; short: string; color: string }> = {
  food: { label: "Gezonde voeding & drankjes", short: "Voeding", color: "#8c9e7a" },
  hydration: { label: "Waterflessen & hydratatie", short: "Hydratatie", color: "#7fa3bd" },
  sport: { label: "Sport & lifestyle", short: "Sport", color: "#cf9a7c" },
  voucher: { label: "Cadeaubonnen & ervaringen", short: "Cadeaubon", color: "#c9a565" },
  challenge: { label: "Extra weekchallenge", short: "Challenge", color: "#6e4034" },
};

export const DEFAULT_WEIGHTS: Record<WheelCategory, number> = { food: 40, hydration: 10, sport: 5, voucher: 10, challenge: 35 };

export interface PrizeLike {
  id: string;
  category: PrizeCategory;
  active: boolean;
  stock: number;
  weekly_max: number | null;
}

/** Same rule as wheel_available_prizes: active, in stock, under the weekly cap. */
export function availablePrizes<P extends PrizeLike>(prizes: readonly P[], winsThisWeek: Record<string, number>): P[] {
  return prizes.filter((p) => p.active && p.stock > 0 && (p.weekly_max === null || (winsThisWeek[p.id] ?? 0) < p.weekly_max));
}

export interface Odds {
  category: WheelCategory;
  weight: number;
  /** 0 to 1, over the categories that can be won right now. */
  chance: number;
}

/**
 * Chances as spin_wheel applies them: only categories with a weight and
 * something to win; the challenge is always available. Wheel order.
 */
export function wheelOdds(weights: Partial<Record<WheelCategory, number>>, available: readonly PrizeLike[]): Odds[] {
  const has = new Set(available.map((p) => p.category));
  const live = WHEEL_CATEGORIES.map((category) => ({ category, weight: Math.max(0, weights[category] ?? DEFAULT_WEIGHTS[category]) })).filter(
    (c) => c.weight > 0 && (c.category === "challenge" || has.has(c.category)),
  );
  const total = live.reduce((a, c) => a + c.weight, 0);
  if (total === 0) return [{ category: "challenge", weight: 1, chance: 1 }];
  return live.map((c) => ({ ...c, chance: c.weight / total }));
}

/** "40%", "12,5%". */
export function formatChance(chance: number): string {
  const pct = Math.round(chance * 1000) / 10;
  return `${pct.toLocaleString("nl-NL", { maximumFractionDigits: 1 })}%`;
}

/** Icons drawn on the wheel (see components/wheel/category-icon). */
export type SlotIcon = "drink" | "bar" | "bottle" | "shaker" | "shirt" | "gift" | "flame";

/**
 * The wheel face: equal slots, each showing a kind of prize. A category can
 * have more than one slot; the chance comes from the database, not from how
 * many slots there are. Order keeps the same category apart.
 */
export const WHEEL_SLOTS: { category: WheelCategory; label: string; icon: SlotIcon }[] = [
  { category: "food", label: "Drankje", icon: "drink" },
  { category: "sport", label: "Sportset", icon: "shirt" },
  { category: "hydration", label: "Shaker", icon: "shaker" },
  { category: "challenge", label: "Challenge", icon: "flame" },
  { category: "voucher", label: "Cadeaubon", icon: "gift" },
  { category: "food", label: "Proteïnereep", icon: "bar" },
  { category: "hydration", label: "Bidon", icon: "bottle" },
  { category: "challenge", label: "Challenge", icon: "flame" },
];

export const SLOT_COLORS = ["#d5dcc8", "#f8efe7", "#ecd3c3"] as const;

export interface Segment {
  category: WheelCategory;
  label: string;
  icon: SlotIcon;
  color: string;
  /** Degrees clockwise from the top. */
  start: number;
  end: number;
}

/** Equal slots for the categories that can be won now; neighbours never share a colour. */
export function segments(odds: readonly Pick<Odds, "category">[]): Segment[] {
  const live = new Set(odds.map((o) => o.category));
  let slots = WHEEL_SLOTS.filter((s) => live.has(s.category));
  if (slots.length === 0) slots = WHEEL_SLOTS.filter((s) => s.category === "challenge");
  while (slots.length < 4) slots = [...slots, ...slots];
  const n = slots.length;
  const colors = slots.map((_, i) => i % 3);
  // With a count that is not a multiple of three, the last slot would match the first.
  if (n % 3 !== 0 && colors[n - 1] === colors[0]) colors[n - 1] = [0, 1, 2].find((c) => c !== colors[0] && c !== colors[n - 2])!;
  return slots.map((s, i) => ({ ...s, color: SLOT_COLORS[colors[i]], start: (360 / n) * i, end: (360 / n) * (i + 1) }));
}

/**
 * Wheel rotation that brings a slot of `category` under the pointer at the
 * top, after a few full turns from `current`. `r` (0 to 1) picks which slot
 * and the spot in it, kept away from the edges.
 */
export function landingRotation(segs: readonly Segment[], category: WheelCategory, current: number, r: number, turns = 6): number {
  const matches = segs.filter((s) => s.category === category);
  const pool = matches.length ? matches : [segs[0]];
  const scaled = Math.min(0.999999, Math.max(0, r)) * pool.length;
  const seg = pool[Math.floor(scaled)];
  const within = scaled - Math.floor(scaled);
  const target = seg.start + (seg.end - seg.start) * (0.2 + 0.6 * within);
  // The pointer is at 0 degrees: rotate the wheel back by the target angle.
  const base = Math.ceil(current / 360) * 360 + turns * 360;
  return base + ((360 - target) % 360);
}

/* --------------------------------------------------------------------------
 * Extra week challenges
 * ------------------------------------------------------------------------ */

export const WHEEL_CHALLENGES = ["hydration", "movement", "sleep", "food", "buddy"] as const;
export type WheelChallengeKey = (typeof WHEEL_CHALLENGES)[number];

export const CHALLENGE_META: Record<WheelChallengeKey, { title: string; rule: string }> = {
  hydration: { title: "Hydration Challenge", rule: "Haal elke dag tot en met zondag je waterdoel van 2,5 liter." },
  movement: { title: "7 Days of Movement", rule: "Beweeg elke dag tot en met zondag: een training of 10.000 stappen." },
  sleep: { title: "Sleep Reset Challenge", rule: "Vink elke dag tot en met zondag 7 tot 9 uur slaap af in je check-in." },
  food: { title: "Healthy Food Challenge", rule: "Vink elke dag tot en met zondag whole foods én genoeg eiwit af." },
  buddy: { title: "Badi Buddy Challenge", rule: "Stuur deze week iedereen in de squad een compliment." },
};

export type DayState = "done" | "missed" | "open";

export interface ChallengeProgress {
  /** Per day from the spin to Sunday, or per squad member for the buddy challenge. */
  steps: { key: string; label: string; state: DayState }[];
  done: number;
  total: number;
  complete: boolean;
  /** A day passed without it: the challenge can no longer be completed. */
  failed: boolean;
}

export interface ChallengeData {
  water: Record<DateKey, number>;
  checkins: Record<DateKey, readonly string[]>;
  steps: Record<DateKey, number>;
  workoutDates: ReadonlySet<DateKey>;
  /** Squad members (not yourself) and whether you sent them a compliment this week. */
  buddies: { id: string; name: string; sent: boolean }[];
}

const DAY_LABELS = ["ma", "di", "wo", "do", "vr", "za", "zo"];

/** Days from the spin day up to and including Sunday of that week. */
export function challengeDays(weekStart: DateKey, spinDate: DateKey): DateKey[] {
  const out: DateKey[] = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStart, i);
    if (d >= spinDate) out.push(d);
  }
  return out.length ? out : [addDays(weekStart, 6)];
}

export function challengeProgress(key: WheelChallengeKey, weekStart: DateKey, spinDate: DateKey, today: DateKey, data: ChallengeData): ChallengeProgress {
  if (key === "buddy") {
    const steps = data.buddies.map((b) => ({ key: b.id, label: b.name, state: (b.sent ? "done" : today > addDays(weekStart, 6) ? "missed" : "open") as DayState }));
    const done = steps.filter((s) => s.state === "done").length;
    const total = steps.length;
    return { steps, done, total, complete: total > 0 && done === total, failed: steps.some((s) => s.state === "missed") };
  }
  const met = (d: DateKey): boolean => {
    const acts = data.checkins[d] ?? [];
    switch (key) {
      case "hydration":
        return (data.water[d] ?? 0) >= 2500;
      case "movement":
        return data.workoutDates.has(d) || (data.steps[d] ?? 0) >= 10_000 || acts.includes("run") || acts.includes("strength") || acts.includes("moved");
      case "sleep":
        return acts.includes("recovery");
      case "food":
        return acts.includes("nutrition") && acts.includes("protein");
    }
  };
  const steps = challengeDays(weekStart, spinDate).map((d) => {
    const idx = (new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7;
    return { key: d, label: DAY_LABELS[idx], state: (met(d) ? "done" : d < today ? "missed" : "open") as DayState };
  });
  const done = steps.filter((s) => s.state === "done").length;
  return { steps, done, total: steps.length, complete: done === steps.length, failed: steps.some((s) => s.state === "missed") };
}

/* --------------------------------------------------------------------------
 * Timing
 * ------------------------------------------------------------------------ */

/** The instant of 00:00 on `date` in `tz`. */
export function zonedMidnight(date: DateKey, tz: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(guess));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const wall = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return new Date(guess - (wall - guess));
}

/** Next spin: Monday 00:00 after the week starting at `weekStart`. */
export function nextSpinAt(weekStart: DateKey, tz: string): Date {
  return zonedMidnight(addDays(weekStart, 7), tz);
}

/** "2 d 5 u", "5 u 12 min", "12 min". */
export function countdownLabel(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 60_000));
  const d = Math.floor(total / 1440);
  const h = Math.floor((total % 1440) / 60);
  const m = total % 60;
  if (d > 0) return `${d} d ${h} u`;
  if (h > 0) return `${h} u ${m} min`;
  return `${m} min`;
}

/* --------------------------------------------------------------------------
 * Prize status
 * ------------------------------------------------------------------------ */

export type SpinStatus = "won" | "claimed" | "ordered" | "delivered" | "challenge";

export const STATUS_LABELS: Record<Exclude<SpinStatus, "challenge">, string> = {
  won: "Nog claimen",
  claimed: "Geclaimd",
  ordered: "Besteld",
  delivered: "Ontvangen",
};

export function formatEuro(cents: number): string {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(cents / 100);
}
