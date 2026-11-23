/**
 * Missions and coins in BADI Wereld, from what you really do in BADI:
 * checked in, trained, drank enough water, walked your steps. Coins are
 * worked out on the server from the database, so they cannot be earned by
 * hand; spending them comes with your own room.
 */
import { WATER_GOAL_ML } from "@/lib/constants";

export const STEPS_GOAL = 10_000;

export type MissionKey = "checkin" | "training" | "water" | "steps";

/** Coins per mission done, per day. */
export const MISSION_COINS: Record<MissionKey, number> = { checkin: 5, training: 10, water: 3, steps: 5 };

export interface Mission {
  key: MissionKey;
  title: string;
  /** Where to do it in the app. */
  href: string;
  done: boolean;
  /** Progress for water and steps, e.g. "1.250 / 2.500 ml". */
  progress: string | null;
  coins: number;
}

/** What one person did on one day. */
export interface DayRecord {
  checkin: boolean;
  training: boolean;
  waterMl: number;
  steps: number;
}

export function missionsDone(d: DayRecord): Record<MissionKey, boolean> {
  return { checkin: d.checkin, training: d.training, water: d.waterMl >= WATER_GOAL_ML, steps: d.steps >= STEPS_GOAL };
}

export function coinsForDay(d: DayRecord): number {
  const done = missionsDone(d);
  return (Object.keys(MISSION_COINS) as MissionKey[]).reduce((n, k) => n + (done[k] ? MISSION_COINS[k] : 0), 0);
}

const nl = (n: number) => new Intl.NumberFormat("nl-NL").format(n);

export function missionsFor(today: DayRecord): Mission[] {
  const done = missionsDone(today);
  return [
    { key: "checkin", title: "Inchecken", href: "/checkin", done: done.checkin, progress: null, coins: MISSION_COINS.checkin },
    { key: "training", title: "Training", href: "/fitness/start", done: done.training, progress: null, coins: MISSION_COINS.training },
    { key: "water", title: "Water drinken", href: "/water", done: done.water, progress: `${nl(Math.min(today.waterMl, WATER_GOAL_ML))} / ${nl(WATER_GOAL_ML)} ml`, coins: MISSION_COINS.water },
    { key: "steps", title: "Stappen", href: "/dashboard", done: done.steps, progress: `${nl(Math.min(today.steps, STEPS_GOAL))} / ${nl(STEPS_GOAL)}`, coins: MISSION_COINS.steps },
  ];
}

/** Everything one person did per day, from the rows in the database. */
export function dayRecords(rows: {
  checkins: { checkin_date: string }[];
  workouts: { workout_date: string }[];
  water: { log_date: string; amount_ml: number }[];
  steps: { log_date: string; steps: number }[];
}): Map<string, DayRecord> {
  const days = new Map<string, DayRecord>();
  const day = (k: string) => {
    let d = days.get(k);
    if (!d) days.set(k, (d = { checkin: false, training: false, waterMl: 0, steps: 0 }));
    return d;
  };
  for (const r of rows.checkins) day(r.checkin_date).checkin = true;
  for (const r of rows.workouts) day(r.workout_date).training = true;
  for (const r of rows.water) day(r.log_date).waterMl += r.amount_ml;
  for (const r of rows.steps) day(r.log_date).steps = Math.max(day(r.log_date).steps, r.steps);
  return days;
}
