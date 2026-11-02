"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { CHAT_PAGE_SIZE, type ChatMessage } from "@/lib/chat";
import type { ActionResult } from "@/lib/types";

const uuid = z.string().uuid();

export async function sendMessage(input: { body: string }): Promise<ActionResult<ChatMessage>> {
  const parsed = z.object({ body: z.string().trim().min(1, "Typ eerst een bericht.").max(1000, "Maximaal 1000 tekens.") }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const ctx = await requireContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("squad_messages")
    .insert({ challenge_id: ctx.challenge.id, user_id: ctx.userId, body: parsed.data.body })
    .select("id, user_id, body, created_at")
    .single();
  if (error || !data) return { ok: false, error: "Versturen is niet gelukt." };
  await supabase.from("squad_chat_reads").upsert({ challenge_id: ctx.challenge.id, user_id: ctx.userId, last_read_at: new Date().toISOString() }, { onConflict: "challenge_id,user_id" });
  return { ok: true, data: data as ChatMessage };
}

export async function deleteMessage(id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Onbekend bericht." };
  const ctx = await requireContext();
  const supabase = await createClient();
  const { error } = await supabase.from("squad_messages").delete().eq("id", id).eq("user_id", ctx.userId);
  if (error) return { ok: false, error: "Verwijderen is niet gelukt." };
  return { ok: true };
}

/** Records that the user has seen the chat up to now; the Squad badge uses this. */
export async function markChatRead(): Promise<ActionResult> {
  const ctx = await requireContext();
  const supabase = await createClient();
  const { error } = await supabase
    .from("squad_chat_reads")
    .upsert({ challenge_id: ctx.challenge.id, user_id: ctx.userId, last_read_at: new Date().toISOString() }, { onConflict: "challenge_id,user_id" });
  if (error) return { ok: false, error: "Opslaan is niet gelukt." };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Older messages before a given moment, newest first in the response. */
export async function loadOlderMessages(before: string): Promise<ActionResult<ChatMessage[]>> {
  if (Number.isNaN(Date.parse(before))) return { ok: false, error: "Ongeldig tijdstip." };
  const ctx = await requireContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("squad_messages")
    .select("id, user_id, body, created_at")
    .eq("challenge_id", ctx.challenge.id)
    .lt("created_at", before)
    .order("created_at", { ascending: false })
    .limit(CHAT_PAGE_SIZE);
  if (error) return { ok: false, error: "Laden is niet gelukt." };
  return { ok: true, data: (data ?? []) as ChatMessage[] };
}
