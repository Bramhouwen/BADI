import { TIMEZONE } from "./constants";

export type DateKey = string; // YYYY-MM-DD

export interface ChallengeWindow {
  start_date: DateKey;
  end_date: DateKey;
  timezone: string;
}

const keyFormatterCache = new Map<string, Intl.DateTimeFormat>();

function keyFormatter(tz: string) {
  let f = keyFormatterCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    keyFormatterCache.set(tz, f);
  }
  return f;
}

/** Calendar date (YYYY-MM-DD) of an instant in the given timezone. */
export function dateKeyInTz(date: Date, tz: string = TIMEZONE): DateKey {
  return keyFormatter(tz).format(date);
}

export function todayKey(now: Date = new Date(), tz: string = TIMEZONE): DateKey {
  return dateKeyInTz(now, tz);
}

export function isValidDateKey(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function addDays(key: DateKey, n: number): DateKey {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Number of days from a to b (b - a). */
export function diffDays(a: DateKey, b: DateKey): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const ms = Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad);
  return Math.round(ms / 86_400_000);
}

export function hourInTz(now: Date = new Date(), tz: string = TIMEZONE): number {
  const h = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hour12: false }).format(now);
  return Number(h) % 24;
}

export function greeting(now: Date = new Date(), tz: string = TIMEZONE): string {
  const h = hourInTz(now, tz);
  if (h < 6) return "Goedenacht!";
  if (h < 12) return "Goedemorgen!";
  if (h < 18) return "Goedemiddag!";
  return "Goedenavond!";
}

export type ChallengePhase = "before" | "during" | "after";

export function challengePhase(challenge: ChallengeWindow, now: Date = new Date()): ChallengePhase {
  const today = todayKey(now, challenge.timezone);
  if (today < challenge.start_date) return "before";
  if (today > challenge.end_date) return "after";
  return "during";
}

export function challengeLengthDays(challenge: ChallengeWindow): number {
  return diffDays(challenge.start_date, challenge.end_date) + 1;
}

/** 1-based day number; 0 before start, length after end. */
export function challengeDay(challenge: ChallengeWindow, now: Date = new Date()): number {
  const today = todayKey(now, challenge.timezone);
  if (today < challenge.start_date) return 0;
  if (today > challenge.end_date) return challengeLengthDays(challenge);
  return diffDays(challenge.start_date, today) + 1;
}

/** Days until the last challenge day. 0 on the final day, negative after. */
export function daysUntilFinale(challenge: ChallengeWindow, now: Date = new Date()): number {
  const today = todayKey(now, challenge.timezone);
  return diffDays(today, challenge.end_date);
}

export function daysUntilStart(challenge: ChallengeWindow, now: Date = new Date()): number {
  const today = todayKey(now, challenge.timezone);
  return diffDays(today, challenge.start_date);
}

/**
 * Dates a member may create or edit right now: today and yesterday
 * (yesterday stays editable until 23:59 today), limited to the challenge period.
 */
export function editableDates(challenge: ChallengeWindow, now: Date = new Date()): DateKey[] {
  const today = todayKey(now, challenge.timezone);
  const candidates = [today, addDays(today, -1)];
  return candidates.filter((d) => d >= challenge.start_date && d <= challenge.end_date);
}

export function isEditableDate(challenge: ChallengeWindow, dateKey: DateKey, now: Date = new Date()): boolean {
  return editableDates(challenge, now).includes(dateKey);
}

export type WrappedStatus = "not_yet" | "preliminary" | "final";

/**
 * Preliminary on the last day and during the correction window the day after.
 * Final once yesterday's edits for the last day are closed.
 */
export function wrappedStatus(challenge: ChallengeWindow, now: Date = new Date()): WrappedStatus {
  const today = todayKey(now, challenge.timezone);
  if (today < challenge.end_date) return "not_yet";
  if (today <= addDays(challenge.end_date, 1)) return "preliminary";
  return "final";
}

/** Dutch long date, e.g. "zondag 1 november". */
export function formatDateNl(key: DateKey, opts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" }): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("nl-NL", { timeZone: "UTC", ...opts }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** Dutch short date for timestamps, in the challenge timezone. */
export function formatDateTimeNl(iso: string, tz: string = TIMEZONE): string {
  return new Intl.DateTimeFormat("nl-NL", {
    timeZone: tz,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Relative label like "zojuist", "5 min geleden", "gisteren". */
export function relativeTimeNl(iso: string, now: Date = new Date(), tz: string = TIMEZONE): string {
  const then = new Date(iso);
  const diffMs = now.getTime() - then.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "zojuist";
  if (minutes < 60) return `${minutes} min geleden`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24 && dateKeyInTz(then, tz) === dateKeyInTz(now, tz)) return `${hours} uur geleden`;
  const dayDiff = diffDays(dateKeyInTz(then, tz), dateKeyInTz(now, tz));
  if (dayDiff === 1) return "gisteren";
  if (dayDiff < 7) return `${dayDiff} dagen geleden`;
  return formatDateNl(dateKeyInTz(then, tz), { day: "numeric", month: "short" });
}

export function weekdayShortNl(key: DateKey): string {
  const [y, m, d] = key.split("-").map(Number);
  const s = new Intl.DateTimeFormat("nl-NL", { timeZone: "UTC", weekday: "short" }).format(new Date(Date.UTC(y, m - 1, d)));
  return s.replace(".", "").slice(0, 2);
}
