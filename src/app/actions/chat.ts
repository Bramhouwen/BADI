"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { mentionsBaddy } from "@/lib/coach/prompt";
import { replyAsBaddyInSquad } from "@/lib/coach/squad";
import { getSquad, requireContext } from "@/lib/data";
import { findMentions, mentionLabels } from "@/lib/mentions";
import { createClient } from "@/lib/supabase/server";
import { CHAT_PAGE_SIZE, type ChatMessage } from "@/lib/chat";
import type { ActionResult } from "@/lib/types";
import { isOwnedMediaPath } from "@/lib/media-paths";

const uuid = z.string().uuid();

const MESSAGE_COLUMNS = "id, user_id, body, created_at, attachment_type, attachment_path, attachment_name, ref_id, is_coach";

const attachmentSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("image"), path: z.string().min(1).max(300) }),
  z.object({ type: z.literal("file"), path: z.string().min(1).max(300), name: z.string().trim().min(1).max(200) }),
  z.object({ type: z.literal("recipe"), refId: uuid }),
  z.object({ type: z.literal("post"), refId: uuid }),
]);
export type MessageAttachment = z.infer<typeof attachmentSchema>;

export async function sendMessage(input: { body: string; attachment?: MessageAttachment }): Promise<ActionResult<ChatMessage>> {
  const parsed = z
    .object({ body: z.string().trim().max(1000, "Maximaal 1000 tekens."), attachment: attachmentSchema.optional() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { body, attachment } = parsed.data;
  if (!body && !attachment) return { ok: false, error: "Typ eerst een bericht." };
  const ctx = await requireContext();
  const supabase = await createClient();

  const squad = body.includes("@") ? await getSquad(ctx.challenge.id) : [];
  const mentions = findMentions(body, mentionLabels(squad.map((m) => ({ id: m.user_id, display_name: m.profile.display_name })))).filter((id) => id !== ctx.userId);
  const row: Record<string, unknown> = { challenge_id: ctx.challenge.id, user_id: ctx.userId, body, mentions };
  if (attachment?.type === "image" || attachment?.type === "file") {
    if (!isOwnedMediaPath(attachment.path, ctx.challenge.id, ctx.userId)) return { ok: false, error: "Ongeldig bestand." };
    row.attachment_type = attachment.type;
    row.attachment_path = attachment.path;
    row.attachment_name = attachment.type === "file" ? attachment.name : null;
  } else if (attachment?.type === "recipe") {
    const { data: recipe } = await supabase.from("recipes").select("id, title").eq("id", attachment.refId).eq("challenge_id", ctx.challenge.id).maybeSingle();
    if (!recipe) return { ok: false, error: "Dit recept bestaat niet meer." };
    row.attachment_type = "recipe";
    row.ref_id = attachment.refId;
    row.attachment_name = String((recipe as { title: string }).title).slice(0, 200);
  } else if (attachment?.type === "post") {
    const { data: post } = await supabase.from("wall_posts").select("id, caption").eq("id", attachment.refId).eq("challenge_id", ctx.challenge.id).maybeSingle();
    if (!post) return { ok: false, error: "Deze foto bestaat niet meer." };
    row.attachment_type = "post";
    row.ref_id = attachment.refId;
    row.attachment_name = ((post as { caption: string | null }).caption ?? "").slice(0, 200) || null;
  }

  const { data, error } = await supabase.from("squad_messages").insert(row).select(MESSAGE_COLUMNS).single();
  if (error || !data) return { ok: false, error: "Versturen is niet gelukt." };
  if (body && mentionsBaddy(body)) {
    // Baddy answers after this response is sent; the reply arrives through Realtime.
    after(() => replyAsBaddyInSquad(supabase, ctx, body));
  }
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
    .select(MESSAGE_COLUMNS)
    .eq("challenge_id", ctx.challenge.id)
    .lt("created_at", before)
    .order("created_at", { ascending: false })
    .limit(CHAT_PAGE_SIZE);
  if (error) return { ok: false, error: "Laden is niet gelukt." };
  return { ok: true, data: (data ?? []) as ChatMessage[] };
}

/** Messages newer than a given moment, oldest first. Used while waiting for Baddy's reply. */
export async function loadNewerMessages(since: string): Promise<ActionResult<ChatMessage[]>> {
  if (Number.isNaN(Date.parse(since))) return { ok: false, error: "Ongeldig tijdstip." };
  const ctx = await requireContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("squad_messages")
    .select(MESSAGE_COLUMNS)
    .eq("challenge_id", ctx.challenge.id)
    .gt("created_at", since)
    .order("created_at", { ascending: true })
    .limit(CHAT_PAGE_SIZE);
  if (error) return { ok: false, error: "Laden is niet gelukt." };
  return { ok: true, data: (data ?? []) as ChatMessage[] };
}
