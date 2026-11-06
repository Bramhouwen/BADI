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

/** Steps are a weekly goal: 1 point per 10,000 steps in the week, at most 7. */
export const STEPS_PER_POINT = 10_000;
export const WEEKLY_STEP_POINTS = 7;
export const WEEKLY_STEPS_GOAL = STEPS_PER_POINT * WEEKLY_STEP_POINTS;

/**
 * Steps per day of a week. A typed count wins; a day ticked as "steps" before
 * steps became a weekly goal counts as 10,000.
 */
export function stepsByDay(start: DateKey, logs: { log_date: DateKey; steps: number }[], checkins: { checkin_date: DateKey; activities: readonly string[] }[] = []): Record<DateKey, number> {
  const out: Record<DateKey, number> = {};
  for (const date of weekDates(start)) {
    const log = logs.find((l) => l.log_date === date);
    const ticked = checkins.find((c) => c.checkin_date === date)?.activities.includes("steps") ?? false;
    out[date] = log ? log.steps : ticked ? STEPS_PER_POINT : 0;
  }
  return out;
}

export function stepPoints(total: number): number {
  return Math.min(WEEKLY_STEP_POINTS, Math.floor(Math.max(0, total) / STEPS_PER_POINT));
}

/** Points available in one week: the daily habits on seven days, the steps goal and the run and strength targets. */
export const WEEK_POINTS = DAILY_HABITS.length * 7 + WEEKLY_STEP_POINTS + WEEKLY_TARGETS.run + WEEKLY_TARGETS.strength;

/**
 * Bonus points on top of the week: something extra for the squad, such as a
 * photo on the Wall or a shared recipe. Each kind counts once per week.
 */
export const BONUS_POINTS = 5;
export const BONUS_KINDS = ["wall", "recipe"] as const;
export type BonusKind = (typeof BONUS_KINDS)[number];
export const BONUS_LABELS: Record<BonusKind, string> = { wall: "Foto op de Wall", recipe: "Recept gedeeld" };
export interface BonusItem {
  kind: BonusKind;
  date: DateKey;
}

/** Bonus kinds earned in the week starting at `start`, each worth BONUS_POINTS once. */
export function weekBonus(start: DateKey, items: readonly BonusItem[]): { kinds: BonusKind[]; points: number } {
  const end = addDays(start, 6);
  const kinds = BONUS_KINDS.filter((k) => items.some((i) => i.kind === k && i.date >= start && i.date <= end));
  return { kinds, points: kinds.length * BONUS_POINTS };
}

export interface WeekScore {
  earned: number;
  /** Bonus points on top of `earned`; not part of `total` or `fraction`. */
  bonus: number;
  total: number;
  /** 0 to 1, for the ring around the profile photo. */
  fraction: number;
}

/**
 * How far a member is this week: daily points done (a joker counts as no
 * alcohol), steps points over the week, plus run and strength sessions up to
 * the weekly target. Resets every Monday; the ring is full when everything for
 * the week is done. Bonus points come on top and leave the ring alone.
 */
export function weekScore(
  start: DateKey,
  checkins: { checkin_date: DateKey; activities: readonly string[] }[],
  jokers: DateKey[] = [],
  steps: { log_date: DateKey; steps: number }[] = [],
  bonus: readonly BonusItem[] = [],
): WeekScore {
  const p = weekProgress(start, checkins, [], jokers);
  const habits = p.days.reduce((n, d) => n + d.habitsDone, 0);
  const training = TRAINING_KINDS.reduce((n, k) => n + Math.min(p.totals[k].done, WEEKLY_TARGETS[k]), 0);
  const walked = stepPoints(Object.values(stepsByDay(start, steps, checkins)).reduce((a, b) => a + b, 0));
  const earned = habits + walked + training;
  return { earned, bonus: weekBonus(start, bonus).points, total: WEEK_POINTS, fraction: Math.min(1, earned / WEEK_POINTS) };
}
