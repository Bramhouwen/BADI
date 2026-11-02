/**
 * Conversations in the squad chat: the group chat plus one private chat per
 * squad member. Pure helpers for the chat list, read ticks, reactions and
 * the "typt" line; shared by server pages, client components and tests.
 */
import type { ChatMessage } from "./chat";

export type ConversationKey = "squad" | `dm:${string}`;

export const SQUAD_KEY: ConversationKey = "squad";

export function dmKey(peerId: string): ConversationKey {
  return `dm:${peerId}`;
}

/** The conversation a message belongs to, seen from `me`. */
export function conversationOf(m: Pick<ChatMessage, "user_id" | "recipient_id">, me: string): ConversationKey {
  if (!m.recipient_id) return SQUAD_KEY;
  return dmKey(m.user_id === me ? m.recipient_id : m.user_id);
}

/** Does a message belong to the open conversation? `peer` null means the group chat. */
export function inConversation(m: Pick<ChatMessage, "user_id" | "recipient_id">, me: string, peer: string | null): boolean {
  return conversationOf(m, me) === (peer ? dmKey(peer) : SQUAD_KEY);
}

export interface ConversationSummary {
  last: ChatMessage | null;
  unread: number;
}

/**
 * Last message and unread count per conversation. `reads` holds the moment
 * the reader last opened each conversation (null = never).
 */
export function summarize(messages: ChatMessage[], me: string, reads: Partial<Record<ConversationKey, string | null>>): Map<ConversationKey, ConversationSummary> {
  const out = new Map<ConversationKey, ConversationSummary>();
  const sorted = [...messages].sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
  for (const m of sorted) {
    const key = conversationOf(m, me);
    const entry = out.get(key) ?? { last: null, unread: 0 };
    entry.last = m;
    const readAt = reads[key] ?? null;
    if (m.user_id !== me && (!readAt || m.created_at > readAt)) entry.unread += 1;
    out.set(key, entry);
  }
  return out;
}

/** Has the other person read my private message? */
export function readByPeer(m: Pick<ChatMessage, "created_at">, peerLastReadAt: string | null): boolean {
  return Boolean(peerLastReadAt && peerLastReadAt >= m.created_at);
}

export interface ReactionRow {
  message_id: string;
  user_id: string;
  emoji: string;
}

export interface ReactionCount {
  emoji: string;
  count: number;
  mine: boolean;
  users: string[];
}

/** Reactions per message, most used first, then in order of first use. */
export function groupReactions(rows: ReactionRow[], me: string): Record<string, ReactionCount[]> {
  const out: Record<string, ReactionCount[]> = {};
  for (const r of rows) {
    const list = (out[r.message_id] ??= []);
    let item = list.find((x) => x.emoji === r.emoji);
    if (!item) {
      item = { emoji: r.emoji, count: 0, mine: false, users: [] };
      list.push(item);
    }
    if (item.users.includes(r.user_id)) continue;
    item.users.push(r.user_id);
    item.count += 1;
    if (r.user_id === me) item.mine = true;
  }
  for (const list of Object.values(out)) list.sort((a, b) => b.count - a.count);
  return out;
}

/** "Sam typt…", "Sam en Alex typen…" or "3 mensen typen…". */
export function typingLabel(names: string[]): string | null {
  if (names.length === 0) return null;
  if (names.length === 1) return `${names[0]} typt…`;
  if (names.length === 2) return `${names[0]} en ${names[1]} typen…`;
  return `${names.length} mensen typen…`;
}

/** Short preview for the chat list, with "Jij:" or the sender's name in the group. */
export function previewLine(m: Pick<ChatMessage, "user_id" | "body" | "attachment_type" | "attachment_name" | "is_coach">, me: string, nameOf: (id: string) => string, group: boolean, attachment: string | null): string {
  const text = m.body?.trim() || attachment || "Bericht";
  if (m.user_id === me && !m.is_coach) return `Jij: ${text}`;
  if (group) return `${m.is_coach ? "Baddy" : nameOf(m.user_id)}: ${text}`;
  return text;
}

export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "🔥", "💪"] as const;

export const EMOJI_GROUPS: { label: string; emoji: string[] }[] = [
  { label: "Smileys", emoji: ["😀", "😁", "😂", "🤣", "😊", "😍", "🥰", "😘", "😎", "🤩", "🥳", "😅", "😇", "🙃", "😉", "😋", "😜", "🤔", "🤗", "😴", "😮", "😢", "😭", "😤", "🥵", "🥶", "🤯", "🙈"] },
  { label: "Gebaren", emoji: ["👍", "👎", "👏", "🙌", "🙏", "💪", "🤝", "✌️", "🤞", "👊", "🫶", "👋", "❤️", "🧡", "💚", "💙", "💜", "🖤", "🔥", "✨", "💯", "⭐", "✅", "❌"] },
  { label: "Sport", emoji: ["🏃", "🏃‍♀️", "🏋️", "🏋️‍♀️", "🚴", "🧘", "🤸", "🏊", "⚽", "🎾", "👟", "⏱️", "🥇", "🏆", "📈", "💧", "😮‍💨", "🛌"] },
  { label: "Eten", emoji: ["🥑", "🥦", "🍳", "🥚", "🍗", "🐟", "🍠", "🥗", "🍓", "🍌", "🍎", "🥜", "🫐", "☕", "🍵", "🥤", "🍷", "🍕"] },
  { label: "Winter", emoji: ["❄️", "☃️", "🌨️", "🧣", "🧤", "🔥", "🌙", "☀️", "🌧️", "🎄", "🕯️", "🍂"] },
];

/** Time in the chat list: the clock time today, "Gisteren", or a short date. */
export function listTime(iso: string, today: string, tz: string): string {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
  if (day === today) return new Intl.DateTimeFormat("nl-NL", { hour: "2-digit", minute: "2-digit", timeZone: tz }).format(new Date(iso));
  const [y, m, d] = today.split("-").map(Number);
  const yesterday = new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
  if (day === yesterday) return "Gisteren";
  const [yy, mm, dd] = day.split("-");
  return yy === String(y) ? `${dd}-${mm}` : `${dd}-${mm}-${yy}`;
}
