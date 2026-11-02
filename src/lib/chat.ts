/**
 * Pure helpers for the squad chat: grouping for display and unread counts.
 */
import { dateKeyInTz, formatDateNl, type DateKey } from "./dates";

export const CHAT_PAGE_SIZE = 40;

export const ATTACHMENT_TYPES = ["image", "file", "recipe", "post"] as const;
export type AttachmentType = (typeof ATTACHMENT_TYPES)[number];

export interface ChatMessage {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  attachment_type?: AttachmentType | null;
  /** Object path in the private "chat" bucket for image and file. */
  attachment_path?: string | null;
  /** File name, recipe title or wall caption at the time of sending. */
  attachment_name?: string | null;
  /** Recipe or wall post id for references. */
  ref_id?: string | null;
  /** True while the optimistic copy waits for the server. */
  pending?: boolean;
}

/** Short label for an attachment, used in previews and accessibility text. */
export function attachmentLabel(m: Pick<ChatMessage, "attachment_type" | "attachment_name">): string | null {
  switch (m.attachment_type) {
    case "image":
      return "Foto";
    case "file":
      return m.attachment_name ? `Bestand: ${m.attachment_name}` : "Bestand";
    case "recipe":
      return m.attachment_name ? `Recept: ${m.attachment_name}` : "Recept";
    case "post":
      return "Foto van de Wall";
    default:
      return null;
  }
}

/** The link an attachment points to inside the app, or null for uploads. */
export function attachmentHref(m: Pick<ChatMessage, "attachment_type" | "ref_id">): string | null {
  if (m.attachment_type === "recipe" && m.ref_id) return `/kitchen/${m.ref_id}`;
  if (m.attachment_type === "post" && m.ref_id) return `/wall/${m.ref_id}`;
  return null;
}

export interface ChatRun {
  key: string;
  user_id: string;
  messages: ChatMessage[];
}

export interface ChatDay {
  date: DateKey;
  label: string;
  runs: ChatRun[];
}

export function dayLabel(date: DateKey, today: DateKey): string {
  if (date === today) return "Vandaag";
  const [y, m, d] = today.split("-").map(Number);
  const yesterday = new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
  if (date === yesterday) return "Gisteren";
  return formatDateNl(date, { weekday: "long", day: "numeric", month: "long" });
}

/** Messages in chronological order, grouped per day and per run of the same sender (within 5 minutes). */
export function groupMessages(messages: ChatMessage[], today: DateKey, tz: string): ChatDay[] {
  const sorted = [...messages].sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
  const days: ChatDay[] = [];
  for (const m of sorted) {
    const date = dateKeyInTz(new Date(m.created_at), tz);
    let day = days[days.length - 1];
    if (!day || day.date !== date) {
      day = { date, label: dayLabel(date, today), runs: [] };
      days.push(day);
    }
    const run = day.runs[day.runs.length - 1];
    const last = run?.messages[run.messages.length - 1];
    const close = last ? Date.parse(m.created_at) - Date.parse(last.created_at) < 5 * 60 * 1000 : false;
    if (run && run.user_id === m.user_id && close) run.messages.push(m);
    else day.runs.push({ key: m.id, user_id: m.user_id, messages: [m] });
  }
  return days;
}

/** Messages from others that arrived after the reader's last visit. */
export function unreadCount(messages: Pick<ChatMessage, "user_id" | "created_at">[], lastReadAt: string | null, me: string): number {
  return messages.filter((m) => m.user_id !== me && (!lastReadAt || m.created_at > lastReadAt)).length;
}

export function formatTime(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("nl-NL", { hour: "2-digit", minute: "2-digit", timeZone: tz }).format(new Date(iso));
}
