/**
 * Daily habits and weekly training targets: pure helpers shared by the
 * check-in page, Home and tests.
 */
import { ACTIVITIES, type ActivityKey } from "./constants";
import { addDays, type DateKey } from "./dates";

export const DAILY_HABITS = ACTIVITIES.filter((a) => a.kind === "daily").map((a) => a.key);
export type TrainingKind = "run" | "strength";
export const WEEKLY_TARGETS: Record<TrainingKind, number> = { run: 3, strength: 3 };
export const TRAINING_KINDS: TrainingKind[] = ["run", "strength"];

export interface DailyScore {
  done: number;
  total: number;
  complete: boolean;
}

/** How many daily habits are done; a joker counts as the alcohol habit. */
export function dailyScore(activities: readonly string[], joker = false): DailyScore {
  const set = new Set(activities);
  const done = DAILY_HABITS.filter((k) => set.has(k) || (k === "alcohol" && joker)).length;
  return { done, total: DAILY_HABITS.length, complete: done === DAILY_HABITS.length };
}

/** Monday-based week containing `date`. */
export function weekStartOf(date: DateKey): DateKey {
  const d = new Date(`${date}T12:00:00Z`);
  const offset = (d.getUTCDay() + 6) % 7;
  return addDays(date, -offset);
}

export function weekDates(start: DateKey): DateKey[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export interface WeekDay {
  date: DateKey;
  planned: TrainingKind[];
  done: TrainingKind[];
  habitsDone: number;
  joker: boolean;
}

export interface WeekProgress {
  days: WeekDay[];
  totals: Record<TrainingKind, { done: number; planned: number; target: number }>;
}

export function weekProgress(
  start: DateKey,
  checkins: { checkin_date: DateKey; activities: readonly string[] }[],
  planned: { plan_date: DateKey; kind: string }[],
  jokers: DateKey[] = [],
): WeekProgress {
  const dates = weekDates(start);
  const byDate = new Map(checkins.map((c) => [c.checkin_date, c.activities]));
  const jokerSet = new Set(jokers);
  const days: WeekDay[] = dates.map((date) => {
    const acts = byDate.get(date) ?? [];
    return {
      date,
      planned: TRAINING_KINDS.filter((k) => planned.some((p) => p.plan_date === date && p.kind === k)),
      done: TRAINING_KINDS.filter((k) => acts.includes(k)),
      habitsDone: dailyScore(acts, jokerSet.has(date)).done,
      joker: jokerSet.has(date),
    };
  });
  const totals = Object.fromEntries(
    TRAINING_KINDS.map((k) => [k, { done: days.filter((d) => d.done.includes(k)).length, planned: days.filter((d) => d.planned.includes(k)).length, target: WEEKLY_TARGETS[k] }]),
  ) as WeekProgress["totals"];
  return { days, totals };
}

/** The manual set after switching one activity on or off. */
export function toggledSet(current: readonly string[], key: ActivityKey, on: boolean): ActivityKey[] {
  const set = new Set(current as ActivityKey[]);
  if (on) set.add(key);
  else set.delete(key);
  return ACTIVITIES.map((a) => a.key).filter((k) => set.has(k));
}
