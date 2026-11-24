"use server";

import { z } from "zod";
import { canSeeWorld } from "@/lib/world/types";
import { requireContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";
import { after } from "next/server";
import { sendPush } from "@/lib/push";
import { firstName } from "@/lib/utils";
import { attachmentLabel } from "@/lib/chat";
import { loadChatList, loadPeople, loadThread } from "@/lib/chat-data";
import type { WorldDm } from "@/lib/world/dm";
import { SPACE_BY_ID, isRoomArea, isSpaceItem, type RoomArea, type SpaceId } from "@/lib/world/spaces";
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

// ---------------------------------------------------------------------------
// Own rooms (fase 4): the shop, furnishing and notes. Buying goes through the
// database function world_buy, which checks the price and your coins.
// ---------------------------------------------------------------------------

const MISSING = new Set(["42P01", "42883", "PGRST202", "PGRST205"]);
const notYet = (e: { code?: string; message?: string } | null) => Boolean(e && (MISSING.has(e.code ?? "") || /does not exist|could not find/i.test(e.message ?? "")));
const NOT_YET = "De kamers staan nog niet in de database (migratie 0032).";

export interface RoomPiece {
  /** The purchase this piece is. */
  id: string;
  itemId: string;
  u: number;
  v: number;
  flip: boolean;
}

export interface RoomState {
  /** What stands in the room, or in the space asked for. */
  pieces: RoomPiece[];
  /** The extra spaces the owner has unlocked. */
  spaces: SpaceId[];
  /** Your own room: what you have in storage, and your coins to spend. */
  storage: { id: string; itemId: string }[] | null;
  coins: number | null;
}

const missingColumn = (e: { code?: string } | null) => e?.code === "42703" || e?.code === "PGRST204";

/**
 * The furniture in someone's room or one of its spaces (everyone in the group
 * may visit), the spaces they unlocked, plus your storage and coins in your own.
 * Storage is shared by the room and its spaces.
 */
export async function loadRoom(ownerId: string, area: RoomArea = "kamer"): Promise<ActionResult<RoomState>> {
  if (!peerId.safeParse(ownerId).success || !isRoomArea(area)) return { ok: false, error: "Onbekende kamer." };
  const ctx = await requireContext();
  if (!canSeeWorld(ctx.membership.role)) return { ok: false, error: "De wereld is nog niet open." };
  const supabase = await createClient();
  type Row = { purchase_id: string; item_id: string; u: number; v: number; flip: boolean; space?: string };
  const query = (cols: string) => supabase.from("world_room_items").select(cols).eq("challenge_id", ctx.challenge.id).eq("user_id", ownerId);
  let { data, error }: { data: unknown; error: { code?: string; message?: string } | null } = await query("purchase_id, item_id, u, v, flip, space");
  // Before migration 0033 there are no spaces: everything stands in the room.
  if (missingColumn(error)) ({ data, error } = await query("purchase_id, item_id, u, v, flip"));
  if (error) return { ok: false, error: notYet(error) ? NOT_YET : "Laden is niet gelukt." };
  const rows = (data ?? []) as Row[];
  const pieces = rows.filter((r) => (r.space ?? "kamer") === area).map((r) => ({ id: r.purchase_id, itemId: r.item_id, u: r.u, v: r.v, flip: r.flip }));
  const { data: unlocked } = await supabase.rpc("world_spaces_of", { p_owner: ownerId });
  const spaces = ((unlocked ?? []) as unknown[]).filter((v): v is SpaceId => typeof v === "string" && SPACE_BY_ID.has(v as SpaceId));
  if (ownerId !== ctx.userId) return { ok: true, data: { pieces, spaces, storage: null, coins: null } };
  const [{ data: bought }, { data: balance }] = await Promise.all([
    supabase.from("world_purchases").select("id, item_id").eq("user_id", ctx.userId).order("created_at"),
    supabase.rpc("world_coins_balance"),
  ]);
  // In storage: what you bought and is nowhere yet; a space is not a piece.
  const placed = new Set(rows.map((p) => p.purchase_id));
  const storage = ((bought ?? []) as { id: string; item_id: string }[]).filter((b) => !placed.has(b.id) && !isSpaceItem(b.item_id)).map((b) => ({ id: b.id, itemId: b.item_id }));
  return { ok: true, data: { pieces, spaces, storage, coins: typeof balance === "number" ? balance : null } };
}

/** Buys a piece for your room. The database checks the price and your coins. */
export async function buyWorldItem(itemId: string): Promise<ActionResult<{ id: string; coins: number | null }>> {
  if (!/^[a-z0-9-]{1,40}$/.test(itemId)) return { ok: false, error: "Dit is niet te koop." };
  const ctx = await requireContext();
  if (!canSeeWorld(ctx.membership.role)) return { ok: false, error: "De wereld is nog niet open." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("world_buy", { p_item: itemId });
  if (error || typeof data !== "string") {
    if (notYet(error)) return { ok: false, error: NOT_YET };
    const message = error?.message ?? "";
    return { ok: false, error: /genoeg munten/i.test(message) ? "Je hebt niet genoeg munten." : /ruimte heb je al/i.test(message) ? "Deze ruimte heb je al." : "Kopen is niet gelukt." };
  }
  const { data: balance } = await supabase.rpc("world_coins_balance");
  return { ok: true, data: { id: data, coins: typeof balance === "number" ? balance : null } };
}

const pieceSchema = z.object({
  id: z.string().uuid(),
  itemId: z.string().regex(/^[a-z0-9-]{1,40}$/),
  u: z.number().int().min(0).max(64),
  v: z.number().int().min(0).max(64),
  flip: z.boolean(),
  space: z.string().refine(isRoomArea).default("kamer"),
});

/** Puts one of your pieces in your room or one of its spaces, or moves it. The database only allows what you bought yourself, in a space you unlocked. */
export async function placeWorldItem(input: RoomPiece & { space?: RoomArea }): Promise<ActionResult> {
  const parsed = pieceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige plek." };
  const ctx = await requireContext();
  if (!canSeeWorld(ctx.membership.role)) return { ok: false, error: "De wereld is nog niet open." };
  const supabase = await createClient();
  const p = parsed.data;
  const { error } = await supabase
    .from("world_room_items")
    // Without migration 0033 there is no space column: only the room itself.
    .upsert({ purchase_id: p.id, user_id: ctx.userId, challenge_id: ctx.challenge.id, item_id: p.itemId, u: p.u, v: p.v, flip: p.flip, ...(p.space !== "kamer" ? { space: p.space } : {}), updated_at: new Date().toISOString() }, { onConflict: "purchase_id" });
  if (error && p.space !== "kamer" && missingColumn(error)) return { ok: false, error: "De extra ruimtes staan nog niet in de database (migratie 0033)." };
  return error ? { ok: false, error: notYet(error) ? NOT_YET : "Neerzetten is niet gelukt." } : { ok: true };
}

/** Takes a piece out of your room, back into storage. */
export async function storeWorldItem(id: string): Promise<ActionResult> {
  if (!peerId.safeParse(id).success) return { ok: false, error: "Onbekend meubel." };
  const ctx = await requireContext();
  const supabase = await createClient();
  const { error } = await supabase.from("world_room_items").delete().eq("purchase_id", id).eq("user_id", ctx.userId);
  return error ? { ok: false, error: "Opbergen is niet gelukt." } : { ok: true };
}

export interface RoomNote {
  id: string;
  author: string;
  kind: "briefje" | "highfive";
  body: string | null;
  at: string;
  read: boolean;
}

const noteSchema = z.object({ ownerId: z.string().uuid(), kind: z.enum(["briefje", "highfive"]), body: z.string().trim().max(200).optional() });

/** Leaves a note or a high five in someone's room; they find it when they come in. */
export async function leaveRoomNote(input: { ownerId: string; kind: "briefje" | "highfive"; body?: string }): Promise<ActionResult> {
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Een briefje is hooguit 200 tekens." };
  const ctx = await requireContext();
  if (!canSeeWorld(ctx.membership.role)) return { ok: false, error: "De wereld is nog niet open." };
  if (parsed.data.ownerId === ctx.userId) return { ok: false, error: "Dit is je eigen kamer." };
  if (parsed.data.kind === "briefje" && !parsed.data.body) return { ok: false, error: "Schrijf eerst iets." };
  const supabase = await createClient();
  const { error } = await supabase.from("world_notes").insert({
    challenge_id: ctx.challenge.id,
    room_owner: parsed.data.ownerId,
    author: ctx.userId,
    kind: parsed.data.kind,
    body: parsed.data.kind === "briefje" ? parsed.data.body : null,
  });
  if (error) return { ok: false, error: notYet(error) ? NOT_YET : "Achterlaten is niet gelukt." };
  // A push for the one whose room it is; tapping it opens their room.
  const visitor = firstName(ctx.profile.display_name);
  const kind = parsed.data.kind;
  const body = parsed.data.body;
  const ownerId = parsed.data.ownerId;
  after(() =>
    sendPush(
      supabase,
      "direct",
      {
        title: `${visitor} was op bezoek in je kamer`,
        body: kind === "highfive" ? `${visitor} liet een high five achter.` : (body ?? ""),
        // Without a room yet, the page ignores the alias and opens the world as usual.
        url: "/wereld?scene=jouw-kamer",
        tag: `wereld-kamer-${ctx.userId}`,
      },
      { only: ownerId },
    ),
  );
  return { ok: true };
}

/** The notes and high fives left in your room, newest first. */
export async function loadRoomNotes(): Promise<ActionResult<RoomNote[]>> {
  const ctx = await requireContext();
  if (!canSeeWorld(ctx.membership.role)) return { ok: false, error: "De wereld is nog niet open." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("world_notes").select("id, author, kind, body, created_at, read_at").eq("room_owner", ctx.userId).order("created_at", { ascending: false }).limit(30);
  if (error) return { ok: false, error: notYet(error) ? NOT_YET : "Laden is niet gelukt." };
  return {
    ok: true,
    data: ((data ?? []) as { id: string; author: string; kind: "briefje" | "highfive"; body: string | null; created_at: string; read_at: string | null }[]).map((n) => ({ id: n.id, author: n.author, kind: n.kind, body: n.body, at: n.created_at, read: Boolean(n.read_at) })),
  };
}

/** Marks the notes in your room as read. */
export async function markRoomNotesRead(): Promise<ActionResult> {
  const ctx = await requireContext();
  const supabase = await createClient();
  await supabase.from("world_notes").update({ read_at: new Date().toISOString() }).eq("room_owner", ctx.userId).is("read_at", null);
  return { ok: true };
}
