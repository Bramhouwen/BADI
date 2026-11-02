"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/data";
import { friendlyError } from "@/lib/errors";
import { todayKey } from "@/lib/dates";
import { WATER_MAX_ENTRY_ML } from "@/lib/constants";
import type { ActionResult } from "@/lib/types";
import { syncWaterSource } from "@/lib/checkin-sync";

const amountSchema = z.number().int().min(1).max(WATER_MAX_ENTRY_ML);

export async function addWater(amountMl: number): Promise<ActionResult<{ total: number }>> {
  const parsed = amountSchema.safeParse(amountMl);
  if (!parsed.success) return { ok: false, error: "Kies een hoeveelheid tussen 1 en 3000 ml." };
  const ctx = await requireContext();
  const supabase = await createClient();
  const today = todayKey(new Date(), ctx.challenge.timezone);
  const { error } = await supabase.from("water_entries").insert({
    challenge_id: ctx.challenge.id,
    user_id: ctx.userId,
    log_date: today,
    amount_ml: parsed.data,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  const { data } = await supabase.from("water_entries").select("amount_ml").eq("user_id", ctx.userId).eq("log_date", today);
  const total = (data ?? []).reduce((s, r) => s + (r.amount_ml as number), 0);
  await syncWaterSource(ctx, today, total);
  revalidatePath("/");
  revalidatePath("/water");
  revalidatePath("/checkin");
  return { ok: true, data: { total } };
}

export async function undoLastWater(): Promise<ActionResult<{ total: number }>> {
  const ctx = await requireContext();
  const supabase = await createClient();
  const today = todayKey(new Date(), ctx.challenge.timezone);
  const { data: last } = await supabase
    .from("water_entries")
    .select("id")
    .eq("user_id", ctx.userId)
    .eq("log_date", today)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (last) {
    const { error } = await supabase.from("water_entries").delete().eq("id", last.id).eq("user_id", ctx.userId);
    if (error) return { ok: false, error: friendlyError(error) };
  }
  const { data } = await supabase.from("water_entries").select("amount_ml").eq("user_id", ctx.userId).eq("log_date", today);
  const total = (data ?? []).reduce((s, r) => s + (r.amount_ml as number), 0);
  await syncWaterSource(ctx, today, total);
  revalidatePath("/");
  revalidatePath("/water");
  revalidatePath("/checkin");
  return { ok: true, data: { total } };
}
