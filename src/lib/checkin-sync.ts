import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AppContext } from "@/lib/data";
import { isEditableDate } from "@/lib/dates";
import type { ActivityKey } from "@/lib/constants";
import { effectiveActivities } from "./checkin-sources";

/**
 * Recomputes the daily check-in for one date from its sources.
 * Writes only inside the correction window (today or yesterday); outside it
 * the day is read-only, exactly like a manual check-in. Idempotent.
 */
export async function recomputeCheckinDay(ctx: AppContext, date: string, note?: string | null): Promise<{ activities: ActivityKey[]; written: boolean }> {
  const supabase = await createClient();
  const { data: rows } = await supabase.from("checkin_sources").select("activity, source").eq("user_id", ctx.userId).eq("checkin_date", date);
  const activities = effectiveActivities((rows ?? []) as { activity: string; source: string }[]);

  if (!isEditableDate(ctx.challenge, date)) return { activities, written: false };

  if (activities.length === 0) {
    await supabase.from("daily_checkins").delete().eq("challenge_id", ctx.challenge.id).eq("user_id", ctx.userId).eq("checkin_date", date);
    return { activities, written: true };
  }

  const patch: Record<string, unknown> = { challenge_id: ctx.challenge.id, user_id: ctx.userId, checkin_date: date, activities };
  if (note !== undefined) patch.note = note;
  const { error } = await supabase.from("daily_checkins").upsert(patch, { onConflict: "challenge_id,user_id,checkin_date" });
  return { activities, written: !error };
}

/** Replaces the manual sources of a day with the given activities. */
export async function setManualSources(ctx: AppContext, date: string, activities: ActivityKey[]): Promise<void> {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("checkin_sources")
    .select("id, activity")
    .eq("user_id", ctx.userId)
    .eq("checkin_date", date)
    .eq("source", "manual");
  const current = new Set(((existing ?? []) as { id: string; activity: string }[]).map((r) => r.activity));
  const wanted = new Set<string>(activities);
  const toDelete = ((existing ?? []) as { id: string; activity: string }[]).filter((r) => !wanted.has(r.activity)).map((r) => r.id);
  const toInsert = activities.filter((a) => !current.has(a));
  if (toDelete.length) await supabase.from("checkin_sources").delete().in("id", toDelete);
  if (toInsert.length) {
    await supabase.from("checkin_sources").insert(
      toInsert.map((activity) => ({ user_id: ctx.userId, challenge_id: ctx.challenge.id, checkin_date: date, activity, source: "manual" })),
    );
  }
}

/** Removes all manual sources of a day (used when a member deletes a check-in). */
export async function clearManualSources(ctx: AppContext, date: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("checkin_sources").delete().eq("user_id", ctx.userId).eq("checkin_date", date).eq("source", "manual");
}

/** Registers (or re-registers) the activities a completed workout supports on its date. */
export async function setWorkoutSources(ctx: AppContext, sessionId: string, date: string, activities: ActivityKey[]): Promise<void> {
  const supabase = await createClient();
  const { data: existing } = await supabase.from("checkin_sources").select("id, checkin_date, activity").eq("user_id", ctx.userId).eq("workout_session_id", sessionId);
  const rows = (existing ?? []) as { id: string; checkin_date: string; activity: string }[];
  const keep = new Set(rows.filter((r) => r.checkin_date === date && activities.includes(r.activity as ActivityKey)).map((r) => r.id));
  const stale = rows.filter((r) => !keep.has(r.id));
  const staleDates = new Set(stale.map((r) => r.checkin_date));
  if (stale.length) await supabase.from("checkin_sources").delete().in("id", stale.map((r) => r.id));
  const present = new Set(rows.filter((r) => keep.has(r.id)).map((r) => r.activity));
  const missing = activities.filter((a) => !present.has(a));
  if (missing.length) {
    await supabase.from("checkin_sources").insert(
      missing.map((activity) => ({ user_id: ctx.userId, challenge_id: ctx.challenge.id, checkin_date: date, activity, source: "workout", workout_session_id: sessionId })),
    );
  }
  for (const d of staleDates) if (d !== date) await recomputeCheckinDay(ctx, d);
  await recomputeCheckinDay(ctx, date);
}

/** Removes a workout's sources and recomputes the affected days. */
export async function clearWorkoutSources(ctx: AppContext, sessionId: string): Promise<void> {
  const supabase = await createClient();
  const { data: existing } = await supabase.from("checkin_sources").select("id, checkin_date").eq("user_id", ctx.userId).eq("workout_session_id", sessionId);
  const rows = (existing ?? []) as { id: string; checkin_date: string }[];
  if (rows.length === 0) return;
  await supabase.from("checkin_sources").delete().in("id", rows.map((r) => r.id));
  for (const d of new Set(rows.map((r) => r.checkin_date))) await recomputeCheckinDay(ctx, d);
}
