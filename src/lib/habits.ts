/**
 * Own habits on the check-in: pure helpers shared by the check-in, the squad
 * profile, Baddy's context and tests. Own habits never count toward the
 * daily score or the streak.
 */
import { addDays, type DateKey } from "./dates";

export const MAX_HABITS = 6;
export const HABIT_NAME_MAX = 40;

export interface Habit {
  id: string;
  name: string;
  emoji: string | null;
  sort_order: number;
}

export interface HabitWithDates {
  id: string;
  name: string;
  emoji: string | null;
  dates: DateKey[];
}

/** Trimmed name with single spaces, or null when empty or too long. */
export function cleanHabitName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.replace(/\s+/g, " ").trim();
  if (!name || name.length > HABIT_NAME_MAX) return null;
  return name;
}

/** First visible symbol of the input (an emoji can be several code units), or null. */
export function cleanEmoji(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value) return null;
  const first = [...new Intl.Segmenter("nl", { granularity: "grapheme" }).segment(value)][0]?.segment ?? "";
  if (!first || first.length > 8 || /^[\p{L}\p{N}\p{P}]$/u.test(first)) return null;
  return first;
}

/** Ticks per day for the seven days starting at `start`. */
export function habitWeek(dates: readonly DateKey[], start: DateKey): boolean[] {
  const set = new Set(dates);
  return Array.from({ length: 7 }, (_, i) => set.has(addDays(start, i)));
}

/** Ids in their new order after moving one item up or down; unchanged at the edges. */
export function moveId(ids: readonly string[], id: string, direction: "up" | "down"): string[] {
  const i = ids.indexOf(id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ids.length) return [...ids];
  const copy = [...ids];
  [copy[i], copy[j]] = [copy[j], copy[i]];
  return copy;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Defensive parse of member_habits(); unknown shapes become "not shared". */
export function parseMemberHabits(raw: unknown): { shared: boolean; habits: HabitWithDates[] } {
  if (!raw || typeof raw !== "object") return { shared: false, habits: [] };
  const o = raw as Record<string, unknown>;
  if (o.shared !== true || !Array.isArray(o.habits)) return { shared: false, habits: [] };
  const habits: HabitWithDates[] = [];
  for (const h of o.habits) {
    if (!h || typeof h !== "object") continue;
    const r = h as Record<string, unknown>;
    const name = cleanHabitName(r.name);
    if (typeof r.id !== "string" || !name) continue;
    const dates = Array.isArray(r.dates) ? r.dates.filter((d): d is string => typeof d === "string" && DATE.test(d)) : [];
    habits.push({ id: r.id, name, emoji: typeof r.emoji === "string" && r.emoji ? r.emoji : null, dates });
  }
  return { shared: true, habits };
}
