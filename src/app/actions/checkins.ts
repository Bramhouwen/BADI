"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/data";
import { friendlyError } from "@/lib/errors";
import { ACTIVITY_KEYS, type ActivityKey } from "@/lib/constants";
import { addDays, isEditableDate, isValidDateKey, todayKey } from "@/lib/dates";
import { computeStreakStats, type StreakStats } from "@/lib/streaks";
import { firstName } from "@/lib/utils";
import { toggledSet, weekStartOf, type TrainingKind } from "@/lib/checkin-plan";
import { manualActivities, recomputeCheckinDay, setManualSources } from "@/lib/checkin-sync";
import { sendPush } from "@/lib/push";
import type { ActionResult } from "@/lib/types";

const dateSchema = z.string().refine(isValidDateKey, "Ongeldige datum.");
const keySchema = z.enum(ACTIVITY_KEYS as [ActivityKey, ...ActivityKey[]]);
const kindSchema = z.enum(["run", "strength"]);

export interface ToggleResult {
  activities: ActivityKey[];
  stats: StreakStats;
}

/** Switches one check-in part on or off for today or yesterday. Workouts and water keep their own ticks. */
export async function toggleActivity(input: { date: string; key: string; on: boolean }): Promise<ActionResult<ToggleResult>> {
  const parsed = z.object({ date: dateSchema, key: keySchema, on: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Onbekend onderdeel." };
  const { date, key, on } = parsed.data;
  const ctx = await requireContext();
  if (!isEditableDate(ctx.challenge, date)) return { ok: false, error: friendlyError("CHECKIN_OUTSIDE_WINDOW") };

  const current = await manualActivities(ctx, date);
  await setManualSources(ctx, date, toggledSet(current, key, on));
  const result = await recomputeCheckinDay(ctx, date);
  if (!result.written) return { ok: false, error: friendlyError("CHECKIN_OUTSIDE_WINDOW") };

  const supabase = await createClient();
  const { data: rows } = await supabase.from("daily_checkins").select("checkin_date").eq("challenge_id", ctx.challenge.id).eq("user_id", ctx.userId);
  const stats = computeStreakStats(((rows ?? []) as { checkin_date: string }[]).map((r) => r.checkin_date), todayKey(new Date(), ctx.challenge.timezone));
  revalidatePath("/", "layout");
  return { ok: true, data: { activities: result.activities, stats } };
}

/**
 * Saves the step count of one day: any day of the current week up to today,
 * plus yesterday. null removes it. On today and yesterday it also keeps the
 * check-in (and so the streak) in step with what was typed.
 */
export async function setSteps(input: { date: string; steps: number | null }): Promise<ActionResult<{ stats: StreakStats | null }>> {
  const parsed = z.object({ date: dateSchema, steps: z.number().int().min(0, "Minimaal 0 stappen.").max(100_000, "Maximaal 100.000 stappen per dag.").nullable() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { date, steps } = parsed.data;
  const ctx = await requireContext();
  const today = todayKey(new Date(), ctx.challenge.timezone);
  const inWeek = date >= weekStartOf(today) && date <= today;
  if ((!inWeek && !isEditableDate(ctx.challenge, date)) || date < ctx.challenge.start_date || date > ctx.challenge.end_date) {
    return { ok: false, error: "Je vult stappen in voor deze week en gisteren." };
  }
  const supabase = await createClient();
  const { error } =
    steps === null
      ? await supabase.from("step_logs").delete().eq("user_id", ctx.userId).eq("log_date", date)
      : await supabase.from("step_logs").upsert({ challenge_id: ctx.challenge.id, user_id: ctx.userId, log_date: date, steps }, { onConflict: "user_id,log_date" });
  if (error) return { ok: false, error: friendlyError(error) };

  let stats: StreakStats | null = null;
  if (isEditableDate(ctx.challenge, date)) {
    const current = await manualActivities(ctx, date);
    await setManualSources(ctx, date, toggledSet(current, "steps", Boolean(steps)));
    await recomputeCheckinDay(ctx, date);
    const { data: rows } = await supabase.from("daily_checkins").select("checkin_date").eq("challenge_id", ctx.challenge.id).eq("user_id", ctx.userId);
    stats = computeStreakStats(((rows ?? []) as { checkin_date: string }[]).map((r) => r.checkin_date), today);
  }
  revalidatePath("/", "layout");
  return { ok: true, data: { stats } };
}

/** Plans (or unplans) a run or strength session on a day this week or next week. */
export async function togglePlan(input: { date: string; kind: string; on: boolean }): Promise<ActionResult> {
  const parsed = z.object({ date: dateSchema, kind: kindSchema, on: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige planning." };
  const { date, kind, on } = parsed.data;
  const ctx = await requireContext();
  const today = todayKey(new Date(), ctx.challenge.timezone);
  const first = weekStartOf(today);
  const last = addDays(first, 13);
  if (date < first || date > last || date < ctx.challenge.start_date || date > ctx.challenge.end_date) return { ok: false, error: "Je plant deze en volgende week." };
  const supabase = await createClient();
  const { error } = on
    ? await supabase.from("planned_trainings").upsert({ challenge_id: ctx.challenge.id, user_id: ctx.userId, plan_date: date, kind: kind as TrainingKind }, { onConflict: "user_id,plan_date,kind" })
    : await supabase.from("planned_trainings").delete().eq("user_id", ctx.userId).eq("plan_date", date).eq("kind", kind);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/checkin");
  return { ok: true };
}

/** Uses one of the two jokers on today or yesterday; the squad gets a chat message, a notification and a push. */
export async function spendJoker(date: string): Promise<ActionResult<{ used: number }>> {
  if (!isValidDateKey(date)) return { ok: false, error: "Ongeldige datum." };
  const ctx = await requireContext();
  if (!isEditableDate(ctx.challenge, date)) return { ok: false, error: friendlyError("CHECKIN_OUTSIDE_WINDOW") };
  const supabase = await createClient();
  const { data: exception, error } = await supabase
    .from("alcohol_exceptions")
    .insert({ challenge_id: ctx.challenge.id, user_id: ctx.userId, exception_date: date })
    .select("id")
    .single();
  if (error || !exception) return { ok: false, error: friendlyError(error) };

  const day = date === todayKey(new Date(), ctx.challenge.timezone) ? "vandaag" : "gisteren";
  const { data: message } = await supabase
    .from("squad_messages")
    .insert({ challenge_id: ctx.challenge.id, user_id: ctx.userId, body: `🃏 Ik zet ${day} een joker in.`, mentions: [] })
    .select("id")
    .single();
  if (message) await supabase.from("alcohol_exceptions").update({ chat_message_id: (message as { id: string }).id }).eq("id", (exception as { id: string }).id);

  const name = firstName(ctx.profile.display_name);
  after(() => sendPush(supabase, "jokers", { title: "Joker ingezet 🃏", body: `${name} zet ${day} een joker in.`, url: "/squad", tag: "joker" }));

  const { count } = await supabase.from("alcohol_exceptions").select("id", { count: "exact", head: true }).eq("user_id", ctx.userId).eq("challenge_id", ctx.challenge.id);
  revalidatePath("/", "layout");
  return { ok: true, data: { used: count ?? 1 } };
}

/** Takes a joker back (today or yesterday only) and removes its chat message. */
export async function undoJoker(date: string): Promise<ActionResult> {
  if (!isValidDateKey(date)) return { ok: false, error: "Ongeldige datum." };
  const ctx = await requireContext();
  if (!isEditableDate(ctx.challenge, date)) return { ok: false, error: friendlyError("CHECKIN_OUTSIDE_WINDOW") };
  const supabase = await createClient();
  const { data: row } = await supabase.from("alcohol_exceptions").select("id, chat_message_id").eq("user_id", ctx.userId).eq("exception_date", date).maybeSingle();
  if (!row) return { ok: true };
  const r = row as { id: string; chat_message_id: string | null };
  if (r.chat_message_id) await supabase.from("squad_messages").delete().eq("id", r.chat_message_id).eq("user_id", ctx.userId);
  const { error } = await supabase.from("alcohol_exceptions").delete().eq("id", r.id).eq("user_id", ctx.userId);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}
