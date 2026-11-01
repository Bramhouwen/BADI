import { addDays, diffDays, type DateKey } from "./dates";

export interface StreakStats {
  current: number;
  longest: number;
  total: number;
  lastDate: DateKey | null;
  checkedInToday: boolean;
  checkedInYesterday: boolean;
}

/**
 * Streak statistics from a list of check-in dates (YYYY-MM-DD).
 * A streak is a run of consecutive calendar days. Today not yet being
 * checked in does not break the streak: a run ending yesterday still counts.
 */
export function computeStreakStats(dates: Iterable<DateKey>, today: DateKey): StreakStats {
  const set = new Set<DateKey>();
  for (const d of dates) if (d) set.add(d);
  const sorted = [...set].sort();

  let longest = 0;
  let run = 0;
  let prev: DateKey | null = null;
  for (const d of sorted) {
    if (prev && diffDays(prev, d) === 1) run += 1;
    else run = 1;
    if (run > longest) longest = run;
    prev = d;
  }

  const yesterday = addDays(today, -1);
  const checkedInToday = set.has(today);
  const checkedInYesterday = set.has(yesterday);

  let current = 0;
  let cursor: DateKey | null = checkedInToday ? today : checkedInYesterday ? yesterday : null;
  while (cursor && set.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  return {
    current,
    longest,
    total: set.size,
    lastDate: sorted.length ? sorted[sorted.length - 1] : null,
    checkedInToday,
    checkedInYesterday,
  };
}

export interface CalendarDay {
  date: DateKey;
  done: boolean;
  isToday: boolean;
  inChallenge: boolean;
}

/** The last `days` calendar days ending today, oldest first. */
export function recentCalendar(
  dates: Iterable<DateKey>,
  today: DateKey,
  days = 7,
  range?: { start_date: DateKey; end_date: DateKey },
): CalendarDay[] {
  const set = new Set(dates);
  const out: CalendarDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    out.push({
      date,
      done: set.has(date),
      isToday: i === 0,
      inChallenge: range ? date >= range.start_date && date <= range.end_date : true,
    });
  }
  return out;
}

/** Milestones that deserve a small celebration. */
export const STREAK_MILESTONES = [3, 7, 14, 21, 30, 45, 61];

export function isMilestone(streak: number): boolean {
  return STREAK_MILESTONES.includes(streak);
}
