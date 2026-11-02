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


const bottleSchema = z.object({
  name: z.string().trim().min(1, "Geef je fles een naam.").max(30, "Maximaal 30 tekens."),
  amount_ml: z.coerce.number().int("Hele milliliters, bijvoorbeeld 870.").min(1, "Minimaal 1 ml.").max(WATER_MAX_ENTRY_ML, "Maximaal 3000 ml."),
});

/** Saves a bottle with an exact size, so it can be added with one tap. */
export async function addWaterBottle(input: { name: string; amount_ml: number | string }): Promise<ActionResult<{ id: string; name: string; amount_ml: number }>> {
  const parsed = bottleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const ctx = await requireContext();
  const supabase = await createClient();
  const { count } = await supabase.from("water_bottles").select("id", { count: "exact", head: true }).eq("user_id", ctx.userId);
  if ((count ?? 0) >= 6) return { ok: false, error: "Maximaal 6 flessen. Verwijder er eerst een." };
  const { data, error } = await supabase
    .from("water_bottles")
    .insert({ challenge_id: ctx.challenge.id, user_id: ctx.userId, name: parsed.data.name, amount_ml: parsed.data.amount_ml })
    .select("id, name, amount_ml")
    .single();
  if (error || !data) return { ok: false, error: friendlyError(error) };
  revalidatePath("/water");
  return { ok: true, data: data as { id: string; name: string; amount_ml: number } };
}

export async function deleteWaterBottle(id: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Onbekende fles." };
  const ctx = await requireContext();
  const supabase = await createClient();
  const { error } = await supabase.from("water_bottles").delete().eq("id", id).eq("user_id", ctx.userId);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/water");
  return { ok: true };
}
