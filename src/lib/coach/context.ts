import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppContext } from "@/lib/data";
import { ACTIVITIES, WATER_GOAL_ML } from "@/lib/constants";
import { challengeDay, challengeLengthDays, challengePhase, formatDateNl, todayKey } from "@/lib/dates";
import { activityMeta, weekStats, type SessionLike } from "@/lib/fitness";
import { computeStreakStats } from "@/lib/streaks";
import { firstName } from "@/lib/utils";
import type { CoachContext } from "./prompt";

/** Everything Baddy may know about the person it is talking to, read with their own session (RLS applies). */
export async function loadCoachContext(supabase: SupabaseClient, ctx: AppContext): Promise<CoachContext> {
  const now = new Date();
  const today = todayKey(now, ctx.challenge.timezone);
  const [{ data: checkins }, { data: water }, { data: sessions }, { count: alcohol }] = await Promise.all([
    supabase.from("daily_checkins").select("checkin_date, activities").eq("user_id", ctx.userId).eq("challenge_id", ctx.challenge.id),
    supabase.from("water_entries").select("amount_ml").eq("user_id", ctx.userId).eq("log_date", today),
    supabase.from("workout_sessions").select("id, activity_type, workout_date, duration_seconds, distance_meters, status, title").eq("user_id", ctx.userId).eq("status", "completed").order("workout_date", { ascending: false }).limit(60),
    supabase.from("alcohol_exceptions").select("id", { count: "exact", head: true }).eq("user_id", ctx.userId),
  ]);
  const rows = (checkins ?? []) as { checkin_date: string; activities: string[] }[];
  const streak = computeStreakStats(rows.map((r) => r.checkin_date), today);
  const todayRow = rows.find((r) => r.checkin_date === today);
  const label = (key: string) => ACTIVITIES.find((a) => a.key === key)?.label ?? key;
  const done = (sessions ?? []) as SessionLike[];
  const week = weekStats(done, today);
  const during = challengePhase(ctx.challenge, now) === "during";

  return {
    firstName: firstName(ctx.profile.display_name),
    today: formatDateNl(today, { day: "numeric", month: "long", year: "numeric" }),
    weekday: formatDateNl(today, { weekday: "long" }),
    challengeDay: during ? challengeDay(ctx.challenge, now) : null,
    challengeLength: challengeLengthDays(ctx.challenge),
    checkedInToday: Boolean(todayRow),
    todayActivities: (todayRow?.activities ?? []).map(label),
    streak: streak.current,
    longestStreak: streak.longest,
    daysCheckedIn: streak.total,
    waterTodayMl: ((water ?? []) as { amount_ml: number }[]).reduce((s, w) => s + w.amount_ml, 0),
    waterGoalMl: WATER_GOAL_ML,
    workoutsThisWeek: week.workouts,
    minutesThisWeek: Math.round(week.seconds / 60),
    kmThisWeek: week.meters / 1000,
    recentWorkouts: done.slice(0, 5).map((s) => ({
      date: formatDateNl(s.workout_date, { weekday: "short", day: "numeric", month: "short" }),
      type: activityMeta(s.activity_type).label,
      minutes: s.duration_seconds ? Math.round(s.duration_seconds / 60) : null,
      km: s.distance_meters ? s.distance_meters / 1000 : null,
    })),
    alcoholExceptionsUsed: alcohol ?? 0,
  };
}
