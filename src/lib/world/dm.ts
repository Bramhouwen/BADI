/**
 * Private messages in BADI Wereld. They are the app's own private chat
 * (squad_messages with a recipient), so a message sent in the world is in
 * Squad > Chat as well. The database only lets the two people in a
 * conversation read it; these helpers decide what to show of it in the world.
 */

export interface WorldDm {
  id: string;
  from: string;
  to: string;
  /** The text, or a label for an attachment ("Foto"). */
  text: string;
  at: string;
}

/** The other person of a private message you are part of; null for the group chat or someone else's message. */
export function dmPeer(m: { user_id: string; recipient_id?: string | null }, me: string): string | null {
  if (!m.recipient_id) return null;
  if (m.user_id === me) return m.recipient_id;
  if (m.recipient_id === me) return m.user_id;
  return null;
}

/**
 * Over whom a private message shows as a balloon with a lock: over the
 * sender, when both of you are in the same room. Only the two of you
 * receive the message, so nobody else ever sees this balloon.
 */
export function lockBalloonOver(m: WorldDm, me: string, inRoom: (id: string) => boolean): string | null {
  if (m.from !== me && m.to !== me) return null;
  const other = m.from === me ? m.to : m.from;
  return inRoom(other) ? m.from : null;
}

/** Unread counts after a new private message: up by one when it is to you and that conversation is not open. */
export function withUnread(unread: Readonly<Record<string, number>>, m: WorldDm, me: string, openWith: string | null): Record<string, number> {
  if (m.to !== me || m.from === openWith) return { ...unread };
  return { ...unread, [m.from]: (unread[m.from] ?? 0) + 1 };
}

export function totalUnread(unread: Readonly<Record<string, number>>): number {
  return Object.values(unread).reduce((n, c) => n + c, 0);
}
