"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/data";
import { friendlyError } from "@/lib/errors";
import { ACTIVITY_KEYS, type ActivityKey } from "@/lib/constants";
import { isEditableDate, isValidDateKey, todayKey } from "@/lib/dates";
import { computeStreakStats, type StreakStats } from "@/lib/streaks";
import type { ActionResult } from "@/lib/types";

const schema = z.object({
  date: z.string().refine(isValidDateKey, "Ongeldige datum."),
  activities: z.array(z.enum(ACTIVITY_KEYS as [ActivityKey, ...ActivityKey[]])).min(1, "Kies minimaal één activiteit.").max(6),
  note: z.string().trim().max(200, "Maximaal 200 tekens.").optional().default(""),
});

export interface SaveCheckinResult {
  stats: StreakStats;
  previousStreak: number;
  created: boolean;
}

export async function saveCheckin(input: { date: string; activities: string[]; note?: string }): Promise<ActionResult<SaveCheckinResult>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { date, activities, note } = parsed.data;

  const ctx = await requireContext();
  if (!isEditableDate(ctx.challenge, date)) return { ok: false, error: friendlyError("CHECKIN_OUTSIDE_WINDOW") };

  const supabase = await createClient();
  const { data: existingRows } = await supabase
    .from("daily_checkins")
    .select("checkin_date")
    .eq("challenge_id", ctx.challenge.id)
    .eq("user_id", ctx.userId);
  const existingDates = (existingRows ?? []).map((r) => r.checkin_date as string);
  const today = todayKey(new Date(), ctx.challenge.timezone);
  const previous = computeStreakStats(existingDates, today);
  const created = !existingDates.includes(date);

  const { error } = await supabase.from("daily_checkins").upsert(
    {
      challenge_id: ctx.challenge.id,
      user_id: ctx.userId,
      checkin_date: date,
      activities: [...new Set(activities)],
      note: note ? note : null,
    },
    { onConflict: "challenge_id,user_id,checkin_date" },
  );
  if (error) return { ok: false, error: friendlyError(error) };

  const stats = computeStreakStats(created ? [...existingDates, date] : existingDates, today);
  revalidatePath("/", "layout");
  return { ok: true, data: { stats, previousStreak: previous.current, created } };
}

export async function deleteCheckin(date: string): Promise<ActionResult> {
  if (!isValidDateKey(date)) return { ok: false, error: "Ongeldige datum." };
  const ctx = await requireContext();
  if (!isEditableDate(ctx.challenge, date)) return { ok: false, error: friendlyError("CHECKIN_OUTSIDE_WINDOW") };
  const supabase = await createClient();
  const { error } = await supabase
    .from("daily_checkins")
    .delete()
    .eq("challenge_id", ctx.challenge.id)
    .eq("user_id", ctx.userId)
    .eq("checkin_date", date);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}
