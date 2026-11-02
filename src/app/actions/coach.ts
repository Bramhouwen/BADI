"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { MAX_MEMORIES } from "@/lib/coach/tools";
import { requireContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

/** Removes the member's own conversation with Baddy. Recipes and plans Baddy made stay. */
export async function clearCoachConversation(): Promise<ActionResult> {
  const ctx = await requireContext();
  const supabase = await createClient();
  const { error } = await supabase.from("coach_messages").delete().eq("user_id", ctx.userId);
  if (error) return { ok: false, error: "Wissen is niet gelukt." };
  revalidatePath("/coach");
  return { ok: true };
}

const uuid = z.string().uuid();

/** Thumbs up (1), down (-1) or cleared (null) on one of Baddy's answers. */
export async function rateCoachMessage(id: string, value: 1 | -1 | null): Promise<ActionResult> {
  if (!uuid.safeParse(id).success || ![1, -1, null].includes(value)) return { ok: false, error: "Ongeldige beoordeling." };
  const ctx = await requireContext();
  const supabase = await createClient();
  const { error } = await supabase.from("coach_messages").update({ feedback: value }).eq("id", id).eq("user_id", ctx.userId).eq("role", "assistant");
  if (error) return { ok: false, error: "Opslaan is niet gelukt." };
  return { ok: true };
}

export async function addCoachMemory(content: string): Promise<ActionResult<{ id: string; content: string }>> {
  const parsed = z.string().trim().min(1, "Typ eerst een notitie.").max(200, "Maximaal 200 tekens.").safeParse(content);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const ctx = await requireContext();
  const supabase = await createClient();
  const { count } = await supabase.from("coach_memories").select("id", { count: "exact", head: true }).eq("user_id", ctx.userId);
  if ((count ?? 0) >= MAX_MEMORIES) return { ok: false, error: `Maximaal ${MAX_MEMORIES} notities. Verwijder er eerst een.` };
  const { data, error } = await supabase
    .from("coach_memories")
    .insert({ challenge_id: ctx.challenge.id, user_id: ctx.userId, content: parsed.data, source: "member" })
    .select("id, content")
    .single();
  if (error || !data) return { ok: false, error: "Opslaan is niet gelukt." };
  revalidatePath("/profile");
  return { ok: true, data: data as { id: string; content: string } };
}

export async function deleteCoachMemory(id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Onbekende notitie." };
  const ctx = await requireContext();
  const supabase = await createClient();
  const { error } = await supabase.from("coach_memories").delete().eq("id", id).eq("user_id", ctx.userId);
  if (error) return { ok: false, error: "Verwijderen is niet gelukt." };
  revalidatePath("/profile");
  return { ok: true };
}
