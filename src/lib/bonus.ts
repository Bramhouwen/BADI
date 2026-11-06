import "server-only";

import { createClient } from "@/lib/supabase/server";
import { addDays, todayKey, type DateKey } from "./dates";
import type { BonusItem } from "./checkin-plan";

export type MemberBonusItem = BonusItem & { user_id: string };

/**
 * Wall photos, recipes, new personal records and completed week challenges since `since` (a Monday), as bonus items with
 * the date in the challenge timezone. Pass `userId` to load one member only.
 */
export async function loadBonusItems(challengeId: string, since: DateKey, timezone: string, userId?: string): Promise<MemberBonusItem[]> {
  const supabase = await createClient();
  // One day earlier: created_at is UTC, the week starts at midnight local time.
  const from = addDays(since, -1);
  let posts = supabase.from("wall_posts").select("user_id, created_at").eq("challenge_id", challengeId).gte("created_at", from);
  let recipes = supabase.from("recipes").select("user_id, created_at").eq("challenge_id", challengeId).gte("created_at", from);
  if (userId) {
    posts = posts.eq("user_id", userId);
    recipes = recipes.eq("user_id", userId);
  }
  let spins = supabase.from("wheel_spins").select("user_id, week_start").eq("challenge_id", challengeId).gte("week_start", since).not("challenge_completed_at", "is", null);
  if (userId) spins = spins.eq("user_id", userId);
  // Until migrations 0023 and 0024 are applied these fail and count as none.
  const [{ data: postRows }, { data: recipeRows }, { data: recordRows }, { data: spinRows }] = await Promise.all([posts, recipes, supabase.rpc("week_records", { p_challenge: challengeId, p_from: since }), spins]);
  const toItems = (rows: { user_id: string; created_at: string }[] | null, kind: BonusItem["kind"]) =>
    (rows ?? []).map((r) => ({ user_id: r.user_id, kind, date: todayKey(new Date(r.created_at), timezone) })).filter((i) => i.date >= since);
  const records = ((recordRows ?? []) as { user_id: string; record_date: string }[])
    .filter((r) => !userId || r.user_id === userId)
    .map((r) => ({ user_id: r.user_id, kind: "record" as const, date: r.record_date }));
  // A completed week challenge counts in the week it was spun.
  const challenges = ((spinRows ?? []) as { user_id: string; week_start: string }[]).map((r) => ({ user_id: r.user_id, kind: "challenge" as const, date: r.week_start }));
  return [...toItems(postRows, "wall"), ...toItems(recipeRows, "recipe"), ...records, ...challenges];
}
