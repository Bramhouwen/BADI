"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/data";
import { friendlyError } from "@/lib/errors";
import { isEditableDate, isValidDateKey } from "@/lib/dates";
import { MAX_HABITS, cleanEmoji, cleanHabitName, moveId, type Habit } from "@/lib/habits";
import type { ActionResult } from "@/lib/types";

const uuid = z.string().uuid();

function revalidateHabits() {
  revalidatePath("/checkin");
  revalidatePath("/squad", "layout");
}

async function ownHabits(userId: string): Promise<Habit[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("custom_habits").select("id, name, emoji, sort_order").eq("user_id", userId).order("sort_order");
  return (data ?? []) as Habit[];
}

/** Adds an own habit at the bottom of the list. Own habits never count toward the daily score. */
export async function addHabit(input: { name: string; emoji?: string }): Promise<ActionResult<Habit>> {
  const name = cleanHabitName(input.name);
  if (!name) return { ok: false, error: "Geef je gewoonte een naam van maximaal 40 tekens." };
  const ctx = await requireContext();
  const current = await ownHabits(ctx.userId);
  if (current.length >= MAX_HABITS) return { ok: false, error: `Maximaal ${MAX_HABITS} eigen gewoontes. Verwijder er eerst een.` };
  const supabase = await createClient();
  const sort_order = current.reduce((m, h) => Math.max(m, h.sort_order), -1) + 1;
  const { data, error } = await supabase
    .from("custom_habits")
    .insert({ challenge_id: ctx.challenge.id, user_id: ctx.userId, name, emoji: cleanEmoji(input.emoji), sort_order })
    .select("id, name, emoji, sort_order")
    .single();
  if (error || !data) return { ok: false, error: friendlyError(error) };
  revalidateHabits();
  return { ok: true, data: data as Habit };
}

export async function updateHabit(id: string, input: { name: string; emoji?: string }): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Onbekende gewoonte." };
  const name = cleanHabitName(input.name);
  if (!name) return { ok: false, error: "Geef je gewoonte een naam van maximaal 40 tekens." };
  const ctx = await requireContext();
  const supabase = await createClient();
  const { error } = await supabase.from("custom_habits").update({ name, emoji: cleanEmoji(input.emoji) }).eq("id", id).eq("user_id", ctx.userId);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidateHabits();
  return { ok: true };
}

/** Removes a habit and its ticked days. */
export async function deleteHabit(id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Onbekende gewoonte." };
  const ctx = await requireContext();
  const supabase = await createClient();
  await supabase.from("custom_habit_logs").delete().eq("habit_id", id).eq("user_id", ctx.userId);
  const { error } = await supabase.from("custom_habits").delete().eq("id", id).eq("user_id", ctx.userId);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidateHabits();
  return { ok: true };
}

export async function moveHabit(id: string, direction: "up" | "down"): Promise<ActionResult> {
  if (!uuid.safeParse(id).success || (direction !== "up" && direction !== "down")) return { ok: false, error: "Onbekende gewoonte." };
  const ctx = await requireContext();
  const habits = await ownHabits(ctx.userId);
  const order = moveId(habits.map((h) => h.id), id, direction);
  const supabase = await createClient();
  for (let i = 0; i < order.length; i++) {
    const h = habits.find((x) => x.id === order[i]);
    if (h && h.sort_order !== i) await supabase.from("custom_habits").update({ sort_order: i }).eq("id", h.id).eq("user_id", ctx.userId);
  }
  revalidateHabits();
  return { ok: true };
}

/** Ticks or unticks an own habit for today or yesterday. */
export async function toggleHabit(input: { habitId: string; date: string; on: boolean }): Promise<ActionResult> {
  if (!uuid.safeParse(input.habitId).success || !isValidDateKey(input.date) || typeof input.on !== "boolean") return { ok: false, error: "Onbekende gewoonte." };
  const ctx = await requireContext();
  if (!isEditableDate(ctx.challenge, input.date)) return { ok: false, error: friendlyError("CHECKIN_OUTSIDE_WINDOW") };
  const supabase = await createClient();
  const { error } = input.on
    ? await supabase.from("custom_habit_logs").upsert({ habit_id: input.habitId, user_id: ctx.userId, log_date: input.date }, { onConflict: "habit_id,log_date" })
    : await supabase.from("custom_habit_logs").delete().eq("habit_id", input.habitId).eq("user_id", ctx.userId).eq("log_date", input.date);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/checkin");
  return { ok: true };
}
