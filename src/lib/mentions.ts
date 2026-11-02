/**
 * @-mentions in chat text. Members are addressed by first name; when two
 * members share a first name the full name is used so the tag stays unique.
 */

export interface MentionMember {
  id: string;
  /** The label after the @, for example "Sam" or "Sam de Vries". */
  label: string;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function mentionLabels(members: { id: string; display_name: string }[]): MentionMember[] {
  const first = (n: string) => n.trim().split(/\s+/)[0] ?? n;
  const counts = new Map<string, number>();
  for (const m of members) {
    const f = first(m.display_name).toLowerCase();
    counts.set(f, (counts.get(f) ?? 0) + 1);
  }
  return members.map((m) => ({ id: m.id, label: (counts.get(first(m.display_name).toLowerCase()) ?? 0) > 1 ? m.display_name.trim() : first(m.display_name) }));
}

/** A regex that matches "@Label" for every member, longest labels first so "Sam de Vries" wins over "Sam". */
function mentionRegex(members: MentionMember[]): RegExp | null {
  const labels = [...members].sort((a, b) => b.label.length - a.label.length).map((m) => escapeRegExp(m.label));
  if (labels.length === 0) return null;
  return new RegExp(`(^|[^\\p{L}\\p{N}_])@(${labels.join("|")})(?![\\p{L}\\p{N}_])`, "giu");
}

/** Ids of the members a text addresses, each once, in order of appearance. */
export function findMentions(body: string, members: MentionMember[]): string[] {
  const re = mentionRegex(members);
  if (!re) return [];
  const byLabel = new Map(members.map((m) => [m.label.toLowerCase(), m.id]));
  const out: string[] = [];
  for (const match of body.matchAll(re)) {
    const id = byLabel.get(match[2].toLowerCase());
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

export interface MentionToken {
  text: string;
  member?: MentionMember;
}

/** Splits text into plain parts and mention parts for rendering. */
export function splitMentions(body: string, members: MentionMember[]): MentionToken[] {
  const re = mentionRegex(members);
  if (!re) return [{ text: body }];
  const byLabel = new Map(members.map((m) => [m.label.toLowerCase(), m]));
  const out: MentionToken[] = [];
  let last = 0;
  for (const match of body.matchAll(re)) {
    const start = (match.index ?? 0) + match[1].length;
    const end = start + 1 + match[2].length;
    if (start > last) out.push({ text: body.slice(last, start) });
    out.push({ text: body.slice(start, end), member: byLabel.get(match[2].toLowerCase()) });
    last = end;
  }
  if (last < body.length) out.push({ text: body.slice(last) });
  return out.length ? out : [{ text: body }];
}

/** The "@query" being typed just before the caret, or null when the caret is not in one. */
export function mentionQuery(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const at = before.lastIndexOf("@");
  if (at < 0) return null;
  if (at > 0 && /[\p{L}\p{N}_]/u.test(before[at - 1])) return null;
  const query = before.slice(at + 1);
  if (/\s/.test(query)) return null;
  return { start: at, query };
}

/** Members whose label starts with the query (empty query lists everyone). */
export function mentionSuggestions(members: MentionMember[], query: string, exclude?: string): MentionMember[] {
  const q = query.toLowerCase();
  return members.filter((m) => m.id !== exclude && m.label.toLowerCase().startsWith(q));
}

/** Replaces the "@query" at `start` with "@Label " and returns the new text and caret position. */
export function applyMention(text: string, caret: number, start: number, label: string): { text: string; caret: number } {
  const inserted = `@${label} `;
  const next = text.slice(0, start) + inserted + text.slice(caret);
  return { text: next, caret: start + inserted.length };
}
