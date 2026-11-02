"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { mentionsBaddy } from "@/lib/coach/prompt";
import { replyAsBaddyInSquad } from "@/lib/coach/squad";
import { getSquad, requireContext } from "@/lib/data";
import { findMentions, mentionLabels } from "@/lib/mentions";
import { createClient } from "@/lib/supabase/server";
import { CHAT_PAGE_SIZE, attachmentLabel, type ChatMessage } from "@/lib/chat";
import type { ReactionRow } from "@/lib/conversations";
import { sendPush } from "@/lib/push";
import { firstName } from "@/lib/utils";
import type { ActionResult } from "@/lib/types";
import { isOwnedMediaPath } from "@/lib/media-paths";
import { MESSAGE_COLUMNS } from "@/lib/chat-columns";

const uuid = z.string().uuid();
const peerSchema = uuid.nullable().optional();

const attachmentSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("image"), path: z.string().min(1).max(300) }),
  z.object({ type: z.literal("file"), path: z.string().min(1).max(300), name: z.string().trim().min(1).max(200) }),
  z.object({ type: z.literal("recipe"), refId: uuid }),
  z.object({ type: z.literal("post"), refId: uuid }),
]);
export type MessageAttachment = z.infer<typeof attachmentSchema>;

/**
 * Sends a message to the squad group chat, or privately to one member when
 * `to` is set. Mentions and @Baddy only work in the group chat.
 */
export async function sendMessage(input: { body: string; attachment?: MessageAttachment; to?: string | null }): Promise<ActionResult<ChatMessage>> {
  const parsed = z
    .object({ body: z.string().trim().max(1000, "Maximaal 1000 tekens."), attachment: attachmentSchema.optional(), to: peerSchema })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { body, attachment } = parsed.data;
  const to = parsed.data.to ?? null;
  if (!body && !attachment) return { ok: false, error: "Typ eerst een bericht." };
  const ctx = await requireContext();
  if (to === ctx.userId) return { ok: false, error: "Je kunt jezelf geen bericht sturen." };
  const supabase = await createClient();

  const squad = to || body.includes("@") ? await getSquad(ctx.challenge.id) : [];
  if (to && !squad.some((m) => m.user_id === to)) return { ok: false, error: "Dit squadlid bestaat niet." };
  const mentions = to ? [] : findMentions(body, mentionLabels(squad.map((m) => ({ id: m.user_id, display_name: m.profile.display_name })))).filter((id) => id !== ctx.userId);
  const row: Record<string, unknown> = { challenge_id: ctx.challenge.id, user_id: ctx.userId, body, mentions, recipient_id: to };
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
  const sender = firstName(ctx.profile.display_name);
  const preview = (body || (attachment ? attachmentLabel({ attachment_type: attachment.type, attachment_name: (row.attachment_name as string | null) ?? null }) ?? "Bijlage" : "")).slice(0, 160);

  if (to) {
    after(() => sendPush(supabase, "direct", { title: sender, body: preview, url: `/squad/chat/${ctx.userId}`, tag: `dm-${ctx.userId}` }, { only: to }));
    await upsertDirectRead(ctx.challenge.id, ctx.userId, to);
    return { ok: true, data: data as ChatMessage };
  }

  if (body && mentionsBaddy(body)) {
    // Baddy answers after this response is sent; the reply arrives through Realtime.
    after(() => replyAsBaddyInSquad(supabase, ctx, body));
  }
  after(async () => {
    for (const id of mentions) await sendPush(supabase, "mentions", { title: `${sender} noemde je`, body: preview, url: "/squad/chat", tag: "squad-mention" }, { only: id });
    await sendPush(supabase, "chat", { title: `${sender} in de squad`, body: preview, url: "/squad/chat", tag: "squad-chat" }, { exclude: mentions });
  });
  await supabase.from("squad_chat_reads").upsert({ challenge_id: ctx.challenge.id, user_id: ctx.userId, last_read_at: new Date().toISOString() }, { onConflict: "challenge_id,user_id" });
  return { ok: true, data: data as ChatMessage };
}

async function upsertDirectRead(challengeId: string, userId: string, peerId: string) {
  const supabase = await createClient();
  await supabase.from("direct_reads").upsert({ user_id: userId, peer_id: peerId, challenge_id: challengeId, last_read_at: new Date().toISOString() }, { onConflict: "user_id,peer_id" });
}

export async function deleteMessage(id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Onbekend bericht." };
  const ctx = await requireContext();
  const supabase = await createClient();
  const { error } = await supabase.from("squad_messages").delete().eq("id", id).eq("user_id", ctx.userId);
  if (error) return { ok: false, error: "Verwijderen is niet gelukt." };
  return { ok: true };
}

/** Records that the user has read a conversation up to now: the group chat, or a private chat with `peer`. */
export async function markChatRead(peer?: string | null): Promise<ActionResult> {
  if (peer && !uuid.safeParse(peer).success) return { ok: false, error: "Onbekend gesprek." };
  const ctx = await requireContext();
  if (peer) {
    await upsertDirectRead(ctx.challenge.id, ctx.userId, peer);
  } else {
    const supabase = await createClient();
    const { error } = await supabase
      .from("squad_chat_reads")
      .upsert({ challenge_id: ctx.challenge.id, user_id: ctx.userId, last_read_at: new Date().toISOString() }, { onConflict: "challenge_id,user_id" });
    if (error) return { ok: false, error: "Opslaan is niet gelukt." };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Older messages before a given moment, newest first in the response. */
export async function loadOlderMessages(before: string, peer?: string | null): Promise<ActionResult<{ messages: ChatMessage[]; reactions: ReactionRow[] }>> {
  if (Number.isNaN(Date.parse(before)) || !peerSchema.safeParse(peer).success) return { ok: false, error: "Ongeldig verzoek." };
  const ctx = await requireContext();
  const supabase = await createClient();
  let q = supabase.from("squad_messages").select(MESSAGE_COLUMNS).eq("challenge_id", ctx.challenge.id);
  q = peer ? q.in("user_id", [ctx.userId, peer]).in("recipient_id", [ctx.userId, peer]) : q.is("recipient_id", null);
  const { data, error } = await q
    .lt("created_at", before)
    .order("created_at", { ascending: false })
    .limit(CHAT_PAGE_SIZE);
  if (error) return { ok: false, error: "Laden is niet gelukt." };
  const messages = (data ?? []) as ChatMessage[];
  const reactions = messages.length ? await reactionsFor(messages.map((m) => m.id)) : [];
  return { ok: true, data: { messages, reactions } };
}

/** Messages newer than a given moment, oldest first. Used while waiting for Baddy's reply. */
export async function loadNewerMessages(since: string, peer?: string | null): Promise<ActionResult<ChatMessage[]>> {
  if (Number.isNaN(Date.parse(since)) || !peerSchema.safeParse(peer).success) return { ok: false, error: "Ongeldig verzoek." };
  const ctx = await requireContext();
  const supabase = await createClient();
  let q = supabase.from("squad_messages").select(MESSAGE_COLUMNS).eq("challenge_id", ctx.challenge.id);
  q = peer ? q.in("user_id", [ctx.userId, peer]).in("recipient_id", [ctx.userId, peer]) : q.is("recipient_id", null);
  const { data, error } = await q
    .gt("created_at", since)
    .order("created_at", { ascending: true })
    .limit(CHAT_PAGE_SIZE);
  if (error) return { ok: false, error: "Laden is niet gelukt." };
  return { ok: true, data: (data ?? []) as ChatMessage[] };
}

async function reactionsFor(ids: string[]): Promise<ReactionRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("message_reactions").select("message_id, user_id, emoji").in("message_id", ids);
  return (data ?? []) as ReactionRow[];
}

const emojiSchema = z.string().min(1).max(16).refine((e) => /\p{Extended_Pictographic}/u.test(e), "Kies een emoji.");

/** Adds or removes your emoji reaction on a message you can see. */
export async function toggleReaction(input: { messageId: string; emoji: string; on: boolean }): Promise<ActionResult> {
  const parsed = z.object({ messageId: uuid, emoji: emojiSchema, on: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige reactie." };
  const ctx = await requireContext();
  const supabase = await createClient();
  const { messageId, emoji, on } = parsed.data;
  const { error } = on
    ? await supabase.from("message_reactions").upsert({ message_id: messageId, user_id: ctx.userId, emoji }, { onConflict: "message_id,user_id,emoji" })
    : await supabase.from("message_reactions").delete().eq("message_id", messageId).eq("user_id", ctx.userId).eq("emoji", emoji);
  if (error) return { ok: false, error: "Reageren is niet gelukt." };
  return { ok: true };
}
