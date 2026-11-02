import "server-only";

import { getSquad, type AppContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { signedUrlMap } from "@/lib/storage";
import { firstName } from "@/lib/utils";
import { BADDY_ID, CHAT_PAGE_SIZE, asSender, attachmentLabel, type ChatMessage } from "@/lib/chat";
import { MESSAGE_COLUMNS } from "@/lib/chat-columns";
import { SQUAD_KEY, dmKey, previewLine, summarize, type ConversationKey, type ReactionRow } from "@/lib/conversations";
import { mentionLabels, type MentionMember } from "@/lib/mentions";

export interface ChatPerson {
  id: string;
  name: string;
  firstName: string;
  avatar: string | null;
}

export interface ChatListItem {
  key: ConversationKey | "baddy";
  href: string;
  title: string;
  /** Member id for the online dot; null for the group and Baddy. */
  userId: string | null;
  avatar: string | null;
  preview: string | null;
  at: string | null;
  unread: number;
}

const BADDY_AVATAR = "/brand/baddy.jpg";

/** Squad members with first names and signed avatar URLs, oldest member first. */
export async function loadPeople(ctx: AppContext): Promise<ChatPerson[]> {
  const squad = await getSquad(ctx.challenge.id);
  const avatars = await signedUrlMap("avatars", squad.map((m) => m.profile.avatar_path).filter((p): p is string => Boolean(p)));
  return squad.map((m) => ({
    id: m.user_id,
    name: m.profile.display_name,
    firstName: firstName(m.profile.display_name),
    avatar: m.profile.avatar_path ? avatars.get(m.profile.avatar_path) ?? null : null,
  }));
}

/**
 * The chat list: the squad group, a private chat per member and Baddy, with
 * the last message and unread count. RLS limits private messages to the ones
 * this member sent or received.
 */
export async function loadChatList(ctx: AppContext, people: ChatPerson[]): Promise<ChatListItem[]> {
  const supabase = await createClient();
  const [{ data: groupRows }, { data: directRows }, { data: groupRead }, { data: directReads }, { data: coachRows }] = await Promise.all([
    supabase.from("squad_messages").select(MESSAGE_COLUMNS).eq("challenge_id", ctx.challenge.id).is("recipient_id", null).order("created_at", { ascending: false }).limit(60),
    supabase.from("squad_messages").select(MESSAGE_COLUMNS).eq("challenge_id", ctx.challenge.id).not("recipient_id", "is", null).order("created_at", { ascending: false }).limit(300),
    supabase.from("squad_chat_reads").select("last_read_at").eq("challenge_id", ctx.challenge.id).eq("user_id", ctx.userId).maybeSingle(),
    supabase.from("direct_reads").select("peer_id, last_read_at").eq("user_id", ctx.userId),
    supabase.from("coach_messages").select("role, body, created_at").eq("user_id", ctx.userId).order("created_at", { ascending: false }).limit(1),
  ]);
  const messages = [...((groupRows ?? []) as ChatMessage[]), ...((directRows ?? []) as ChatMessage[])];
  const reads: Partial<Record<ConversationKey, string | null>> = { [SQUAD_KEY]: (groupRead as { last_read_at?: string } | null)?.last_read_at ?? null };
  for (const r of (directReads ?? []) as { peer_id: string; last_read_at: string }[]) reads[dmKey(r.peer_id)] = r.last_read_at;
  const sums = summarize(messages, ctx.userId, reads);
  const nameOf = (id: string) => people.find((p) => p.id === id)?.firstName ?? "Lid";
  const line = (m: ChatMessage | null, group: boolean) => (m ? previewLine(m, ctx.userId, nameOf, group, attachmentLabel(m)) : null);

  const group = sums.get(SQUAD_KEY);
  const items: ChatListItem[] = [
    { key: SQUAD_KEY, href: "/squad/chat", title: "The Squad", userId: null, avatar: null, preview: line(group?.last ?? null, true), at: group?.last?.created_at ?? null, unread: group?.unread ?? 0 },
  ];
  const direct = people
    .filter((p) => p.id !== ctx.userId)
    .map((p): ChatListItem => {
      const s = sums.get(dmKey(p.id));
      return { key: dmKey(p.id), href: `/squad/chat/${p.id}`, title: p.firstName, userId: p.id, avatar: p.avatar, preview: line(s?.last ?? null, false), at: s?.last?.created_at ?? null, unread: s?.unread ?? 0 };
    })
    // Most recent conversation first; members you never wrote with keep their squad order.
    .sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));
  const coach = ((coachRows ?? []) as { role: string; body: string; created_at: string }[])[0];
  items.push(...direct, {
    key: "baddy",
    href: "/coach",
    title: "Baddy de Coach",
    userId: null,
    avatar: BADDY_AVATAR,
    preview: coach ? `${coach.role === "user" ? "Jij: " : ""}${coach.body.replace(/\s+/g, " ").slice(0, 120)}` : "Vraag je coach om advies",
    at: coach?.created_at ?? null,
    unread: 0,
  });
  return items;
}

export interface ThreadData {
  messages: ChatMessage[];
  hasMore: boolean;
  reactions: ReactionRow[];
  signed: Record<string, string>;
  /** When the other person last read this private chat (null for the group). */
  peerLastRead: string | null;
  mentionMembers: MentionMember[];
}

/** The latest page of one conversation: the group chat (`peer` null) or a private chat. */
export async function loadThread(ctx: AppContext, people: ChatPerson[], peer: string | null): Promise<ThreadData> {
  const supabase = await createClient();
  let q = supabase.from("squad_messages").select(MESSAGE_COLUMNS).eq("challenge_id", ctx.challenge.id);
  q = peer ? q.in("user_id", [ctx.userId, peer]).in("recipient_id", [ctx.userId, peer]) : q.is("recipient_id", null);
  const [{ data: rows }, { data: peerRead }] = await Promise.all([
    q.order("created_at", { ascending: false }).limit(CHAT_PAGE_SIZE),
    peer ? supabase.from("direct_reads").select("last_read_at").eq("user_id", peer).eq("peer_id", ctx.userId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const newestFirst = (rows ?? []) as ChatMessage[];
  const messages = [...newestFirst].reverse().map(asSender);
  const ids = newestFirst.map((m) => m.id);
  const paths = messages.map((m) => m.attachment_path).filter((p): p is string => Boolean(p));
  const [{ data: reactionRows }, signedMap] = await Promise.all([
    ids.length ? supabase.from("message_reactions").select("message_id, user_id, emoji").in("message_id", ids) : Promise.resolve({ data: [] }),
    signedUrlMap("chat", paths),
  ]);
  const mentionMembers = peer ? [] : [...mentionLabels(people.map((p) => ({ id: p.id, display_name: p.name }))), { id: BADDY_ID, label: "Baddy" }];
  return {
    messages,
    hasMore: newestFirst.length === CHAT_PAGE_SIZE,
    reactions: (reactionRows ?? []) as ReactionRow[],
    signed: Object.fromEntries(signedMap),
    peerLastRead: (peerRead as { last_read_at?: string } | null)?.last_read_at ?? null,
    mentionMembers,
  };
}

/** Recipes and Wall photos that can be shared in the chat. */
export async function loadShareables(ctx: AppContext) {
  const supabase = await createClient();
  const [{ data: recipeRows }, { data: postRows }] = await Promise.all([
    supabase.from("recipes").select("id, title, image_path").eq("challenge_id", ctx.challenge.id).order("created_at", { ascending: false }).limit(40),
    supabase.from("wall_posts").select("id, image_path, caption").eq("challenge_id", ctx.challenge.id).order("created_at", { ascending: false }).limit(40),
  ]);
  const recipeRaw = (recipeRows ?? []) as { id: string; title: string; image_path: string | null }[];
  const postRaw = (postRows ?? []) as { id: string; image_path: string; caption: string | null }[];
  const [recipeImages, postImages] = await Promise.all([
    signedUrlMap("recipes", recipeRaw.map((r) => r.image_path).filter((p): p is string => Boolean(p))),
    signedUrlMap("wall", postRaw.map((p) => p.image_path)),
  ]);
  return {
    recipes: recipeRaw.map((r) => ({ id: r.id, title: r.title, image: r.image_path ? recipeImages.get(r.image_path) ?? null : null })),
    posts: postRaw.map((p) => ({ id: p.id, image: postImages.get(p.image_path) ?? null, caption: p.caption })),
  };
}
