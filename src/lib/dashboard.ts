/**
 * The personal performance dashboard: pure calculations over a member's own
 * check-ins, water, workouts and habits. Shared by the page and tests.
 */
import { addDays, type DateKey } from "./dates";
import { WEEK_POINTS, dailyScore, weekScore, weekStartOf } from "./checkin-plan";
import { WATER_GOAL_ML } from "./constants";
import type { SessionLike } from "./fitness";

export interface CheckinRow {
  checkin_date: DateKey;
  activities: readonly string[];
}

/** Daily points (0 to 6) per date; a joker counts as the alcohol point. */
export function pointsByDate(checkins: CheckinRow[], jokers: DateKey[]): Map<DateKey, number> {
  const jokerSet = new Set(jokers);
  const out = new Map<DateKey, number>();
  for (const c of checkins) out.set(c.checkin_date, dailyScore(c.activities, jokerSet.has(c.checkin_date)).done);
  for (const j of jokerSet) if (!out.has(j)) out.set(j, 1);
  return out;
}

/** Points per day Monday to Sunday of the week that starts at `start`. */
export function weekDays(start: DateKey, points: Map<DateKey, number>): { date: DateKey; points: number }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i);
    return { date, points: points.get(date) ?? 0 };
  });
}

/** Week score (0 to 1) for the last `weeks` weeks ending this week, oldest first. */
export function weekScoreSeries(today: DateKey, checkins: CheckinRow[], jokers: DateKey[], weeks: number): { start: DateKey; fraction: number; earned: number }[] {
  const thisWeek = weekStartOf(today);
  return Array.from({ length: weeks }, (_, i) => {
    const start = addDays(thisWeek, -7 * (weeks - 1 - i));
    const end = addDays(start, 6);
    const s = weekScore(
      start,
      checkins.filter((c) => c.checkin_date >= start && c.checkin_date <= end),
      jokers.filter((j) => j >= start && j <= end),
    );
    return { start, fraction: s.fraction, earned: s.earned };
  });
}

export interface HeatCell {
  date: DateKey;
  /** Null for days after today: nothing to show yet. */
  points: number | null;
}

/** Calendar of the challenge in Monday-based week columns; days outside the challenge are null slots. */
export function heatmap(startDate: DateKey, endDate: DateKey, today: DateKey, points: Map<DateKey, number>): (HeatCell | null)[][] {
  const columns: (HeatCell | null)[][] = [];
  for (let week = weekStartOf(startDate); week <= endDate; week = addDays(week, 7)) {
    columns.push(
      Array.from({ length: 7 }, (_, i) => {
        const date = addDays(week, i);
        if (date < startDate || date > endDate) return null;
        return { date, points: date > today ? null : points.get(date) ?? 0 };
      }),
    );
  }
  return columns;
}

/** Water per day for the last `days` days ending today, oldest first. */
export function waterDays(entries: { log_date: DateKey; amount_ml: number }[], today: DateKey, days: number): { date: DateKey; ml: number }[] {
  const byDate = new Map<DateKey, number>();
  for (const e of entries) byDate.set(e.log_date, (byDate.get(e.log_date) ?? 0) + e.amount_ml);
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, -(days - 1 - i));
    return { date, ml: byDate.get(date) ?? 0 };
  });
}

export function daysOnWaterGoal(series: { ml: number }[]): number {
  return series.filter((d) => d.ml >= WATER_GOAL_ML).length;
}

export type TrainingGroup = "run" | "strength" | "other";

export function trainingGroup(type: string): TrainingGroup {
  return type === "run" ? "run" : type === "strength" ? "strength" : "other";
}

/** Completed workouts per week by group, plus minutes and running km, oldest first. */
export function trainingWeeks(sessions: SessionLike[], today: DateKey, weeks: number): { start: DateKey; run: number; strength: number; other: number; minutes: number; runKm: number }[] {
  const thisWeek = weekStartOf(today);
  return Array.from({ length: weeks }, (_, i) => {
    const start = addDays(thisWeek, -7 * (weeks - 1 - i));
    const end = addDays(start, 6);
    const inWeek = sessions.filter((s) => s.status === "completed" && s.workout_date >= start && s.workout_date <= end);
    const count = (g: TrainingGroup) => inWeek.filter((s) => trainingGroup(s.activity_type) === g).length;
    return {
      start,
      run: count("run"),
      strength: count("strength"),
      other: count("other"),
      minutes: Math.round(inWeek.reduce((a, s) => a + (s.duration_seconds ?? 0), 0) / 60),
      runKm: Math.round(inWeek.filter((s) => s.activity_type === "run").reduce((a, s) => a + (s.distance_meters ?? 0), 0) / 100) / 10,
    };
  });
}

/** Change against the previous period, or null when there is nothing to compare with. */
export function delta(current: number, previous: number): number | null {
  if (current === 0 && previous === 0) return null;
  return Math.round((current - previous) * 10) / 10;
}

/** Share of the days so far in the challenge with at least one check-in point. */
export function consistency(points: Map<DateKey, number>, startDate: DateKey, today: DateKey): { days: number; active: number; pct: number } {
  let days = 0;
  let active = 0;
  for (let d = startDate; d <= today; d = addDays(d, 1)) {
    days += 1;
    if ((points.get(d) ?? 0) > 0) active += 1;
  }
  return { days, active, pct: days ? Math.round((active / days) * 100) : 0 };
}

export { WEEK_POINTS };
