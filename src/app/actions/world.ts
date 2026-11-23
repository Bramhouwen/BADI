"use server";

import { z } from "zod";
import { canSeeWorld } from "@/lib/world/types";
import { requireContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";
import { attachmentLabel } from "@/lib/chat";
import { loadChatList, loadPeople, loadThread } from "@/lib/chat-data";
import type { WorldDm } from "@/lib/world/dm";
import { loadWorldGame, type WorldGame } from "@/lib/world/missions-server";

const schema = z.object({
  scene: z.string().regex(/^[a-z0-9-]{1,40}$/),
  x: z.number().finite().min(0).max(10000),
  y: z.number().finite().min(0).max(10000),
  activity: z.string().regex(/^[a-z0-9-]{1,40}$/).nullable().optional(),
});

/**
 * Remembers where you are in the world (scene and the spot of your feet in
 * its background), and the seat or spot you are on, so the others see you
 * there in a rest pose while you are offline.
 */
export async function saveWorldPosition(input: { scene: string; x: number; y: number; activity?: string | null }): Promise<ActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Onbekende plek." };
  const ctx = await requireContext();
  if (!canSeeWorld(ctx.membership.role)) return { ok: false, error: "De wereld is nog niet open." };
  const supabase = await createClient();
  const row = { scene: parsed.data.scene, x: Math.round(parsed.data.x), y: Math.round(parsed.data.y), updated_at: new Date().toISOString() };
  let { error } = await supabase
    .from("world_profiles")
    .update({ ...row, activity: parsed.data.activity ?? null })
    .eq("user_id", ctx.userId);
  // Before migration 0031 there is no activity column: keep at least the place.
  if (error && (error.code === "42703" || error.code === "PGRST204")) ({ error } = await supabase.from("world_profiles").update(row).eq("user_id", ctx.userId));
  return error ? { ok: false, error: "Je plek is niet bewaard." } : { ok: true };
}

export interface WorldInboxItem {
  userId: string;
  name: string;
  avatar: string | null;
  preview: string | null;
  at: string | null;
  unread: number;
}

/**
 * Your private conversations for the post box in the world: the same list as
 * Squad > Chat, without the group chat and Baddy. The database only returns
 * messages you sent or received.
 */
export async function loadWorldInbox(): Promise<ActionResult<WorldInboxItem[]>> {
  const ctx = await requireContext();
  if (!canSeeWorld(ctx.membership.role)) return { ok: false, error: "De wereld is nog niet open." };
  const people = await loadPeople(ctx);
  const list = await loadChatList(ctx, people);
  const items = list.flatMap((i) => (i.userId ? [{ userId: i.userId, name: i.title, avatar: i.avatar, preview: i.preview, at: i.at, unread: i.unread }] : []));
  return { ok: true, data: items };
}

const peerId = z.string().uuid();

/** The latest messages of your private conversation with one member, oldest first. */
export async function loadWorldThread(peer: string): Promise<ActionResult<{ messages: WorldDm[]; peerLastRead: string | null }>> {
  if (!peerId.safeParse(peer).success) return { ok: false, error: "Onbekend gesprek." };
  const ctx = await requireContext();
  if (!canSeeWorld(ctx.membership.role)) return { ok: false, error: "De wereld is nog niet open." };
  const people = await loadPeople(ctx);
  if (!people.some((p) => p.id === peer)) return { ok: false, error: "Onbekend gesprek." };
  const thread = await loadThread(ctx, people, peer);
  const messages = thread.messages.map((m) => ({ id: m.id, from: m.user_id, to: m.recipient_id ?? "", text: m.body || attachmentLabel(m) || "Bijlage", at: m.created_at }));
  return { ok: true, data: { messages, peerLastRead: thread.peerLastRead } };
}

/** Your missions of today, your coins and whether you may spin the Weekrad, from your own data. */
export async function loadWorldGameState(): Promise<ActionResult<WorldGame>> {
  const ctx = await requireContext();
  if (!canSeeWorld(ctx.membership.role)) return { ok: false, error: "De wereld is nog niet open." };
  return { ok: true, data: await loadWorldGame(ctx) };
}
