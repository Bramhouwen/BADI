import "server-only";

import { createClient } from "@/lib/supabase/server";
import { addDays, todayKey, type DateKey } from "./dates";
import { stepsGoalWeeks, type BonusItem } from "./checkin-plan";

export type MemberBonusItem = BonusItem & { user_id: string };

/**
 * Wall photos, recipes, weeks with the steps goal reached and completed week
 * challenges since `since` (a Monday), as bonus items with the date in the
 * challenge timezone. Pass `userId` to load one member only.
 */
export async function loadBonusItems(challengeId: string, since: DateKey, timezone: string, userId?: string): Promise<MemberBonusItem[]> {
  const supabase = await createClient();
  // One day earlier: created_at is UTC, the week starts at midnight local time.
  const from = addDays(since, -1);
  const today = todayKey(new Date(), timezone);
  let posts = supabase.from("wall_posts").select("user_id, created_at").eq("challenge_id", challengeId).gte("created_at", from);
  let recipes = supabase.from("recipes").select("user_id, created_at").eq("challenge_id", challengeId).gte("created_at", from);
  let spins = supabase.from("wheel_spins").select("user_id, week_start").eq("challenge_id", challengeId).gte("week_start", since).not("challenge_completed_at", "is", null);
  // RLS returns steps and check-ins of members who share them.
  let steps = supabase.from("step_logs").select("user_id, log_date, steps").eq("challenge_id", challengeId).gte("log_date", since);
  let checkins = supabase.from("daily_checkins").select("user_id, checkin_date, activities").eq("challenge_id", challengeId).gte("checkin_date", since);
  if (userId) {
    posts = posts.eq("user_id", userId);
    recipes = recipes.eq("user_id", userId);
    spins = spins.eq("user_id", userId);
    steps = steps.eq("user_id", userId);
    checkins = checkins.eq("user_id", userId);
  }
  const [{ data: postRows }, { data: recipeRows }, { data: spinRows }, { data: stepRows }, { data: checkinRows }] = await Promise.all([posts, recipes, spins, steps, checkins]);
  const toItems = (rows: { user_id: string; created_at: string }[] | null, kind: BonusItem["kind"]) =>
    (rows ?? []).map((r) => ({ user_id: r.user_id, kind, date: todayKey(new Date(r.created_at), timezone) })).filter((i) => i.date >= since);
  // A completed week challenge counts in the week it was spun.
  const challenges = ((spinRows ?? []) as { user_id: string; week_start: string }[]).map((r) => ({ user_id: r.user_id, kind: "challenge" as const, date: r.week_start }));
  // The steps goal counts in the week it was reached.
  const logs = (stepRows ?? []) as { user_id: string; log_date: string; steps: number }[];
  const ticks = (checkinRows ?? []) as { user_id: string; checkin_date: string; activities: string[] }[];
  const members = new Set([...logs.map((l) => l.user_id), ...ticks.map((c) => c.user_id)]);
  const stepsItems = [...members].flatMap((id) =>
    stepsGoalWeeks(
      since,
      today,
      logs.filter((l) => l.user_id === id),
      ticks.filter((c) => c.user_id === id),
    ).map((w) => ({ user_id: id, kind: "steps" as const, date: w })),
  );
  return [...toItems(postRows, "wall"), ...toItems(recipeRows, "recipe"), ...stepsItems, ...challenges];
}
