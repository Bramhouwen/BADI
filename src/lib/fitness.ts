import { Activity, Bike, Dumbbell, Flame, Footprints, Leaf, Route, type LucideIcon } from "lucide-react";
import type { ActivityKey } from "./constants";
import { addDays, diffDays, type DateKey } from "./dates";

export type ActivityType = "run" | "walk" | "cycle" | "strength" | "hiit" | "yoga" | "other";
export type MuscleGroup = "legs" | "chest" | "back" | "shoulders" | "arms" | "core" | "cardio" | "other";

export interface ActivityMeta {
  key: ActivityType;
  label: string;
  hint: string;
  icon: LucideIcon;
  /** Cardio types log distance; strength logs exercises and sets. */
  kind: "cardio" | "strength" | "duration";
  /** Which daily check-in activities a completed workout of this type supports. */
  checkin: ActivityKey[];
}

/** Central rule for the check-in link. Strength also counts as movement. */
export const ACTIVITY_TYPES: ActivityMeta[] = [
  { key: "run", label: "Hardlopen", hint: "Afstand, duur en tempo", icon: Footprints, kind: "cardio", checkin: ["run"] },
  { key: "walk", label: "Wandelen", hint: "Afstand en duur", icon: Route, kind: "cardio", checkin: ["moved"] },
  { key: "cycle", label: "Fietsen", hint: "Afstand, duur en snelheid", icon: Bike, kind: "cardio", checkin: ["moved"] },
  { key: "strength", label: "Krachttraining", hint: "Oefeningen, sets en gewichten", icon: Dumbbell, kind: "strength", checkin: ["strength"] },
  { key: "hiit", label: "HIIT", hint: "Intervallen op tijd", icon: Flame, kind: "duration", checkin: ["moved"] },
  { key: "yoga", label: "Yoga en mobiliteit", hint: "Rustig bewegen en rekken", icon: Leaf, kind: "duration", checkin: ["moved"] },
  { key: "other", label: "Overig", hint: "Elke andere training", icon: Activity, kind: "duration", checkin: ["moved"] },
];

export const ACTIVITY_TYPE_KEYS = ACTIVITY_TYPES.map((a) => a.key) as ActivityType[];

export function activityMeta(key: string): ActivityMeta {
  return ACTIVITY_TYPES.find((a) => a.key === key) ?? ACTIVITY_TYPES[ACTIVITY_TYPES.length - 1];
}

export const MUSCLE_GROUPS: { key: MuscleGroup; label: string }[] = [
  { key: "legs", label: "Benen" },
  { key: "chest", label: "Borst" },
  { key: "back", label: "Rug" },
  { key: "shoulders", label: "Schouders" },
  { key: "arms", label: "Armen" },
  { key: "core", label: "Core" },
  { key: "cardio", label: "Cardio" },
  { key: "other", label: "Overig" },
];

export function muscleLabel(key: string): string {
  return MUSCLE_GROUPS.find((m) => m.key === key)?.label ?? "Overig";
}

/* ------------------------------------------------------------------------ */
/* Units and calculations. Distances in meters, durations in seconds.        */
/* ------------------------------------------------------------------------ */

/** Average pace in seconds per kilometre, or null when either value is missing or zero. */
export function paceSecPerKm(distanceMeters: number | null | undefined, durationSeconds: number | null | undefined): number | null {
  if (!distanceMeters || !durationSeconds || distanceMeters <= 0 || durationSeconds <= 0) return null;
  return durationSeconds / (distanceMeters / 1000);
}

/** Average speed in km/h, or null when either value is missing or zero. */
export function speedKmh(distanceMeters: number | null | undefined, durationSeconds: number | null | undefined): number | null {
  if (!distanceMeters || !durationSeconds || distanceMeters <= 0 || durationSeconds <= 0) return null;
  return distanceMeters / 1000 / (durationSeconds / 3600);
}

export function formatPace(secPerKm: number | null): string {
  if (secPerKm === null || !Number.isFinite(secPerKm)) return "–";
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s === 60 ? 0 : s).padStart(2, "0")} /km`;
}

export function formatSpeed(kmh: number | null): string {
  if (kmh === null || !Number.isFinite(kmh)) return "–";
  return `${new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 1 }).format(kmh)} km/u`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "–";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}u ${String(m).padStart(2, "0")}m`;
  if (m > 0) return s > 0 ? `${m}m ${String(s).padStart(2, "0")}s` : `${m} min`;
  return `${s}s`;
}

export function formatMinutes(seconds: number): string {
  return `${Math.round(seconds / 60)} min`;
}

export function formatDistance(meters: number | null | undefined): string {
  if (!meters || meters <= 0) return "–";
  return `${new Intl.NumberFormat("nl-NL", { maximumFractionDigits: meters >= 10000 ? 1 : 2 }).format(meters / 1000)} km`;
}

export function formatKg(kg: number | null | undefined): string {
  if (kg === null || kg === undefined) return "–";
  return `${new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 1 }).format(kg)} kg`;
}

export interface SetLike {
  weight_kg: number | null;
  repetitions: number | null;
  completed: boolean;
}

/** Training volume = sum of weight × reps over completed sets. Bodyweight sets (no weight) add nothing. */
export function sessionVolumeKg(sets: SetLike[]): number {
  return sets.reduce((sum, s) => (s.completed && s.weight_kg && s.repetitions ? sum + s.weight_kg * s.repetitions : sum), 0);
}

export function formatVolume(kg: number): string {
  return `${new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 0 }).format(kg)} kg`;
}

/* ------------------------------------------------------------------------ */
/* Aggregations                                                              */
/* ------------------------------------------------------------------------ */

export interface SessionLike {
  id: string;
  activity_type: ActivityType | string;
  workout_date: DateKey;
  duration_seconds: number | null;
  distance_meters: number | null;
  status: "draft" | "completed" | string;
  title: string;
}

/** Monday-based week start for a date key. */
export function weekStart(date: DateKey): DateKey {
  const [y, m, d] = date.split("-").map(Number);
  const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // 0 = Monday
  return addDays(date, -dow);
}

export interface WeekStats {
  workouts: number;
  seconds: number;
  meters: number;
  activeDays: number;
}

export function weekStats(sessions: SessionLike[], today: DateKey): WeekStats {
  const start = weekStart(today);
  const end = addDays(start, 6);
  const inWeek = sessions.filter((s) => s.status === "completed" && s.workout_date >= start && s.workout_date <= end);
  return {
    workouts: inWeek.length,
    seconds: inWeek.reduce((a, s) => a + (s.duration_seconds ?? 0), 0),
    meters: inWeek.reduce((a, s) => a + (s.distance_meters ?? 0), 0),
    activeDays: new Set(inWeek.map((s) => s.workout_date)).size,
  };
}

export interface WeekBucket {
  start: DateKey;
  workouts: number;
  seconds: number;
  meters: number;
}

/** Last `weeks` weeks ending in the current week, oldest first. */
export function weeklyBuckets(sessions: SessionLike[], today: DateKey, weeks = 8): WeekBucket[] {
  const thisWeek = weekStart(today);
  const buckets: WeekBucket[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = addDays(thisWeek, -7 * i);
    const end = addDays(start, 6);
    const inWeek = sessions.filter((s) => s.status === "completed" && s.workout_date >= start && s.workout_date <= end);
    buckets.push({
      start,
      workouts: inWeek.length,
      seconds: inWeek.reduce((a, s) => a + (s.duration_seconds ?? 0), 0),
      meters: inWeek.reduce((a, s) => a + (s.distance_meters ?? 0), 0),
    });
  }
  return buckets;
}

export interface RunningProgress {
  runs: { id: string; date: DateKey; meters: number; pace: number | null; title: string }[];
  longestMeters: number;
  /** Fastest 5 km: only runs between 5,0 and 5,5 km, time scaled to exactly 5 km. */
  fastest5kSeconds: number | null;
}

export function runningProgress(sessions: SessionLike[]): RunningProgress {
  const runs = sessions
    .filter((s) => s.status === "completed" && s.activity_type === "run" && (s.distance_meters ?? 0) > 0)
    .sort((a, b) => (a.workout_date < b.workout_date ? -1 : 1))
    .map((s) => ({ id: s.id, date: s.workout_date, meters: s.distance_meters ?? 0, pace: paceSecPerKm(s.distance_meters, s.duration_seconds), title: s.title }));
  const longestMeters = runs.reduce((m, r) => Math.max(m, r.meters), 0);
  let fastest5k: number | null = null;
  for (const r of runs) {
    if (r.meters >= 5000 && r.meters <= 5500 && r.pace) {
      const t = r.pace * 5;
      if (fastest5k === null || t < fastest5k) fastest5k = t;
    }
  }
  return { runs, longestMeters, fastest5kSeconds: fastest5k };
}

export interface ExerciseRecord {
  exerciseId: string;
  name: string;
  maxWeightKg: number;
  maxWeightDate: DateKey;
  bestSessionVolumeKg: number;
  history: { date: DateKey; topWeightKg: number; volumeKg: number }[];
}

export interface StrengthInput {
  sessionId: string;
  date: DateKey;
  exerciseId: string;
  name: string;
  sets: SetLike[];
}

/** Per-exercise records from completed sets across sessions. */
export function strengthRecords(rows: StrengthInput[]): ExerciseRecord[] {
  const byExercise = new Map<string, ExerciseRecord>();
  for (const row of rows) {
    const completed = row.sets.filter((s) => s.completed && (s.weight_kg ?? 0) > 0);
    if (completed.length === 0) continue;
    const top = Math.max(...completed.map((s) => s.weight_kg ?? 0));
    const volume = sessionVolumeKg(row.sets);
    const rec = byExercise.get(row.exerciseId) ?? { exerciseId: row.exerciseId, name: row.name, maxWeightKg: 0, maxWeightDate: row.date, bestSessionVolumeKg: 0, history: [] };
    if (top > rec.maxWeightKg) {
      rec.maxWeightKg = top;
      rec.maxWeightDate = row.date;
    }
    rec.bestSessionVolumeKg = Math.max(rec.bestSessionVolumeKg, volume);
    rec.history.push({ date: row.date, topWeightKg: top, volumeKg: volume });
    byExercise.set(row.exerciseId, rec);
  }
  for (const rec of byExercise.values()) rec.history.sort((a, b) => (a.date < b.date ? -1 : 1));
  return [...byExercise.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Most workouts in any Monday-based week. */
export function mostWorkoutsInAWeek(sessions: SessionLike[]): { count: number; weekStart: DateKey | null } {
  const counts = new Map<DateKey, number>();
  for (const s of sessions) {
    if (s.status !== "completed") continue;
    const w = weekStart(s.workout_date);
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  let best: { count: number; weekStart: DateKey | null } = { count: 0, weekStart: null };
  for (const [w, c] of counts) if (c > best.count) best = { count: c, weekStart: w };
  return best;
}

/** Simple client-side timer model based on timestamps, robust against background tabs. */
export interface TimerState {
  startedAt: number | null; // epoch ms of the current running segment
  accumulated: number; // seconds completed in earlier segments
}

export function timerElapsed(state: TimerState, now: number = Date.now()): number {
  return state.accumulated + (state.startedAt ? Math.max(0, Math.floor((now - state.startedAt) / 1000)) : 0);
}

export function daysAgo(date: DateKey, today: DateKey): number {
  return diffDays(date, today);
}
