/**
 * Squad statistics: pure derivations over the filtered payload that the
 * database RPC `squad_member_stats` returns. Nothing here reads data; the
 * sharing decisions were already applied server side.
 *
 * Period definitions (used consistently in the UI):
 *  - week: Monday to Sunday, the week that contains today
 *  - month: the calendar month that contains today
 *  - total: everything the member ever logged
 *  - check-in consistency: check-ins within the challenge divided by the
 *    challenge days elapsed so far (start date to today, capped at the end)
 */
import { addDays, diffDays, type DateKey } from "./dates";
import { weekStart, type SessionLike } from "./fitness";
import { computeStreakStats } from "./streaks";

export const SHARING_OPTIONS = [
  { key: "workout_counts", label: "Trainingsaantallen", hint: "Aantal trainingen per week, per maand en in totaal." },
  { key: "minutes_distance", label: "Trainingsminuten en afstand", hint: "Duur van je trainingen en loop- en wandelafstand." },
  { key: "active_days", label: "Actieve dagen", hint: "Op welke dagen je trainde, zonder verdere details." },
  { key: "checkins", label: "Check-in consistentie en streaks", hint: "Ook gebruikt op het Squad-overzicht, in de tijdlijn en in Wrapped." },
  { key: "records", label: "Persoonlijke records", hint: "Snelste 5 km, langste loop en zwaarste gewicht per oefening." },
  { key: "recent_workouts", label: "Recente trainingen", hint: "Je laatste tien trainingen: type, datum, duur en afstand." },
  { key: "habits", label: "Eigen gewoontes", hint: "Je eigen gewoontes en op welke dagen je ze deze week afvinkte." },
  { key: "water", label: "Water", hint: "Hoeveel je vandaag dronk en je gemiddelde deze week." },
] as const;

export type SharingKey = (typeof SHARING_OPTIONS)[number]["key"];
export type SharingFlags = Record<SharingKey, boolean>;

/** Everything is shared unless a member switches it off (since 05-11-2026). */
export const DEFAULT_SHARING: SharingFlags = {
  workout_counts: true,
  minutes_distance: true,
  active_days: true,
  checkins: true,
  records: true,
  recent_workouts: true,
  habits: true,
  water: true,
};

export const ALL_SHARED: SharingFlags = {
  workout_counts: true,
  minutes_distance: true,
  active_days: true,
  checkins: true,
  records: true,
  recent_workouts: true,
  habits: true,
  water: true,
};

export interface SharedSession {
  activity_type: string;
  workout_date: DateKey;
  duration_seconds: number | null;
  distance_meters: number | null;
}

export interface SharedRecords {
  longest_run_meters: number | null;
  fastest_5k_seconds: number | null;
  strength: { exercise: string; max_weight_kg: number }[];
}

export interface MemberStatsPayload {
  user_id: string;
  sharing: SharingFlags;
  sessions: SharedSession[];
  workout_dates: DateKey[];
  checkin_dates: DateKey[];
  records: SharedRecords | null;
  recent: SharedSession[];
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}
function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null;
}
function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function sessionList(v: unknown): SharedSession[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((r) => (r && typeof r === "object" ? (r as Record<string, unknown>) : null))
    .filter((r): r is Record<string, unknown> => Boolean(r))
    .map((r) => ({ activity_type: str(r.activity_type), workout_date: str(r.workout_date), duration_seconds: num(r.duration_seconds), distance_meters: num(r.distance_meters) }))
    .filter((r) => r.workout_date.length === 10);
}
function dateList(v: unknown): DateKey[] {
  return Array.isArray(v) ? v.filter((d): d is string => typeof d === "string" && d.length === 10) : [];
}

/** Defensive parse of the RPC result; unknown shapes become empty data, never a crash. */
export function parseMemberStats(raw: unknown): MemberStatsPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const sh = (o.sharing && typeof o.sharing === "object" ? o.sharing : {}) as Record<string, unknown>;
  const sharing: SharingFlags = {
    workout_counts: bool(sh.workout_counts, false),
    minutes_distance: bool(sh.minutes_distance, false),
    active_days: bool(sh.active_days, false),
    checkins: bool(sh.checkins, false),
    records: bool(sh.records, false),
    recent_workouts: bool(sh.recent_workouts, false),
    // Habits (member_habits()) and water (shares_stat()) are read separately.
    habits: false,
    water: false,
  };
  let records: SharedRecords | null = null;
  if (sharing.records && o.records && typeof o.records === "object") {
    const r = o.records as Record<string, unknown>;
    records = {
      longest_run_meters: num(r.longest_run_meters),
      fastest_5k_seconds: num(r.fastest_5k_seconds),
      strength: Array.isArray(r.strength)
        ? r.strength
            .map((x) => (x && typeof x === "object" ? (x as Record<string, unknown>) : null))
            .filter((x): x is Record<string, unknown> => Boolean(x))
            .map((x) => ({ exercise: str(x.exercise), max_weight_kg: num(x.max_weight_kg) ?? 0 }))
            .filter((x) => x.exercise && x.max_weight_kg > 0)
        : [],
    };
  }
  return {
    user_id: str(o.user_id),
    sharing,
    sessions: sharing.workout_counts ? sessionList(o.sessions) : [],
    workout_dates: dateList(o.workout_dates),
    checkin_dates: sharing.checkins ? dateList(o.checkin_dates) : [],
    records,
    recent: sharing.recent_workouts ? sessionList(o.recent) : [],
  };
}

export interface ChallengeWindowLike {
  start_date: DateKey;
  end_date: DateKey;
}

export interface MemberStats {
  /** Workouts per period; null when not shared. */
  workouts: { week: number; month: number; total: number } | null;
  /** Minutes and run/walk distance; null when duration and distance are not shared. */
  effort: { minutesWeek: number; minutesMonth: number; minutesTotal: number; distanceMonthMeters: number } | null;
  /** Unique days with a completed workout; null when not shared. */
  activeDays: { week: number; month: number; total: number } | null;
  /** Check-in figures; null when not shared. */
  checkin: { total: number; consistencyPct: number; current: number; longest: number; checkedInToday: boolean; daysElapsed: number } | null;
  records: SharedRecords | null;
  recent: SharedSession[];
  workoutDates: Set<DateKey>;
  checkinDates: Set<DateKey>;
  lastActiveDate: DateKey | null;
  sharing: SharingFlags;
}

function inWeek(date: DateKey, start: DateKey): boolean {
  const d = diffDays(start, date);
  return d >= 0 && d <= 6;
}
function inMonth(date: DateKey, today: DateKey): boolean {
  return date.slice(0, 7) === today.slice(0, 7);
}

export function deriveMemberStats(p: MemberStatsPayload, today: DateKey, challenge: ChallengeWindowLike): MemberStats {
  const ws = weekStart(today);
  const sessions: SessionLike[] = p.sessions.map((s, i) => ({ id: String(i), title: "", status: "completed", ...s }));

  const workoutDates = new Set<DateKey>();
  for (const s of sessions) workoutDates.add(s.workout_date);
  for (const d of p.workout_dates) workoutDates.add(d);

  const workouts = p.sharing.workout_counts
    ? {
        week: sessions.filter((s) => inWeek(s.workout_date, ws)).length,
        month: sessions.filter((s) => inMonth(s.workout_date, today)).length,
        total: sessions.length,
      }
    : null;

  const sum = (list: SessionLike[], f: (s: SessionLike) => number) => list.reduce((a, s) => a + f(s), 0);
  const effort =
    p.sharing.workout_counts && p.sharing.minutes_distance
      ? {
          minutesWeek: Math.round(sum(sessions.filter((s) => inWeek(s.workout_date, ws)), (s) => s.duration_seconds ?? 0) / 60),
          minutesMonth: Math.round(sum(sessions.filter((s) => inMonth(s.workout_date, today)), (s) => s.duration_seconds ?? 0) / 60),
          minutesTotal: Math.round(sum(sessions, (s) => s.duration_seconds ?? 0) / 60),
          distanceMonthMeters: sum(
            sessions.filter((s) => inMonth(s.workout_date, today) && (s.activity_type === "run" || s.activity_type === "walk")),
            (s) => s.distance_meters ?? 0,
          ),
        }
      : null;

  const activeDays =
    p.sharing.active_days || p.sharing.workout_counts
      ? {
          week: [...workoutDates].filter((d) => inWeek(d, ws)).length,
          month: [...workoutDates].filter((d) => inMonth(d, today)).length,
          total: workoutDates.size,
        }
      : null;

  const checkinDates = new Set<DateKey>(p.checkin_dates.filter((d) => d >= challenge.start_date && d <= challenge.end_date));
  let checkin: MemberStats["checkin"] = null;
  if (p.sharing.checkins) {
    const streak = computeStreakStats(checkinDates, today);
    const last = today < challenge.end_date ? today : challenge.end_date;
    const daysElapsed = today < challenge.start_date ? 0 : diffDays(challenge.start_date, last) + 1;
    checkin = {
      total: checkinDates.size,
      consistencyPct: daysElapsed > 0 ? Math.min(100, Math.round((checkinDates.size / daysElapsed) * 100)) : 0,
      current: streak.current,
      longest: streak.longest,
      checkedInToday: streak.checkedInToday,
      daysElapsed,
    };
  }

  const all = [...workoutDates, ...checkinDates].filter((d) => d <= today).sort();
  const lastActiveDate = all.length ? all[all.length - 1] : null;

  return { workouts, effort, activeDays, checkin, records: p.records, recent: p.recent, workoutDates, checkinDates, lastActiveDate, sharing: p.sharing };
}

/** One short, neutral status line based on shared data only. */
export function activityStatus(s: MemberStats, today: DateKey): string | null {
  if (s.checkin?.checkedInToday) return "Vandaag ingecheckt";
  if (s.workoutDates.has(today)) return "Vandaag getraind";
  if (!s.lastActiveDate) return null;
  const gap = diffDays(s.lastActiveDate, today);
  if (gap === 1) return "Gisteren actief";
  if (gap <= 6) return `${gap} dagen geleden actief`;
  return "Langer dan een week geleden actief";
}

export type GridMode = "week" | "prev-week" | "month";

export interface GridDay {
  date: DateKey;
  dayOfMonth: number;
  workout: boolean;
  checkin: boolean;
  future: boolean;
  isToday: boolean;
}

function daysInMonth(today: DateKey): number {
  const [y, m] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Days for the activity grid; one entry per calendar day in the chosen period. */
export function gridDays(s: Pick<MemberStats, "workoutDates" | "checkinDates">, today: DateKey, mode: GridMode): GridDay[] {
  let start: DateKey;
  let count: number;
  if (mode === "week") {
    start = weekStart(today);
    count = 7;
  } else if (mode === "prev-week") {
    start = addDays(weekStart(today), -7);
    count = 7;
  } else {
    start = `${today.slice(0, 7)}-01`;
    count = daysInMonth(today);
  }
  const out: GridDay[] = [];
  for (let i = 0; i < count; i += 1) {
    const date = addDays(start, i);
    out.push({
      date,
      dayOfMonth: Number(date.slice(-2)),
      workout: s.workoutDates.has(date),
      checkin: s.checkinDates.has(date),
      future: date > today,
      isToday: date === today,
    });
  }
  return out;
}

export interface CompareRow {
  key: string;
  label: string;
  mine: string;
  theirs: string;
}

function minutesLabel(n: number): string {
  return `${n} min`;
}

/** Side by side figures, only for categories the other member shares. Numbers only, no judgement. */
export function compareRows(mine: MemberStats, theirs: MemberStats): CompareRow[] {
  const rows: CompareRow[] = [];
  if (theirs.workouts && mine.workouts) rows.push({ key: "workouts_week", label: "Trainingen deze week", mine: String(mine.workouts.week), theirs: String(theirs.workouts.week) });
  if (theirs.activeDays && mine.activeDays) rows.push({ key: "active_month", label: "Actieve dagen deze maand", mine: String(mine.activeDays.month), theirs: String(theirs.activeDays.month) });
  if (theirs.effort && mine.effort) rows.push({ key: "minutes_month", label: "Trainingsminuten deze maand", mine: minutesLabel(mine.effort.minutesMonth), theirs: minutesLabel(theirs.effort.minutesMonth) });
  if (theirs.checkin && mine.checkin) rows.push({ key: "consistency", label: "Check-in consistentie", mine: `${mine.checkin.consistencyPct}%`, theirs: `${theirs.checkin.consistencyPct}%` });
  return rows;
}

/** Maps the database row of stat_sharing to flags; a missing row means the defaults. */
export function sharingFromRow(row: Record<string, unknown> | null | undefined): SharingFlags {
  if (!row) return { ...DEFAULT_SHARING };
  return {
    workout_counts: bool(row.share_workout_counts, DEFAULT_SHARING.workout_counts),
    minutes_distance: bool(row.share_minutes_distance, DEFAULT_SHARING.minutes_distance),
    active_days: bool(row.share_active_days, DEFAULT_SHARING.active_days),
    checkins: bool(row.share_checkins, DEFAULT_SHARING.checkins),
    records: bool(row.share_records, DEFAULT_SHARING.records),
    recent_workouts: bool(row.share_recent_workouts, DEFAULT_SHARING.recent_workouts),
    habits: bool(row.share_habits, DEFAULT_SHARING.habits),
    water: bool(row.share_water, DEFAULT_SHARING.water),
  };
}

export function sharingToRow(flags: SharingFlags): Record<`share_${SharingKey}`, boolean> {
  return {
    share_workout_counts: flags.workout_counts,
    share_minutes_distance: flags.minutes_distance,
    share_active_days: flags.active_days,
    share_checkins: flags.checkins,
    share_records: flags.records,
    share_recent_workouts: flags.recent_workouts,
    share_habits: flags.habits,
    share_water: flags.water,
  };
}
