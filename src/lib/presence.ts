"use client";

import { useSyncExternalStore } from "react";

/**
 * Who of the squad has the app open right now. Filled by PresenceTracker
 * (Supabase Realtime Presence) and read by any avatar on the page.
 */
let online: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

export function setOnline(ids: Iterable<string>) {
  const next = new Set(ids);
  if (next.size === online.size && [...next].every((id) => online.has(id))) return;
  online = next;
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** True while this member has the app open. Always false on the server. */
export function useIsOnline(userId: string | undefined): boolean {
  return useSyncExternalStore(
    subscribe,
    () => (userId ? online.has(userId) : false),
    () => false,
  );
}

/* ------------------------------------------------------------------------ */
/* Typing: who is typing in which conversation ("squad" or "dm:<sender>").    */
/* ------------------------------------------------------------------------ */

const TYPING_TTL = 4500;
let typing: ReadonlyMap<string, readonly string[]> = new Map();
const typingListeners = new Set<() => void>();
const expiries = new Map<string, ReturnType<typeof setTimeout>>();
let sender: ((to: string) => void) | null = null;

function publishTyping(next: ReadonlyMap<string, readonly string[]>) {
  typing = next;
  for (const l of typingListeners) l();
}

/** Called by PresenceTracker when someone else starts typing in `key`. */
export function receiveTyping(key: string, userId: string) {
  const id = `${key}|${userId}`;
  const existing = typing.get(key) ?? [];
  if (!existing.includes(userId)) publishTyping(new Map(typing).set(key, [...existing, userId]));
  clearTimeout(expiries.get(id));
  expiries.set(
    id,
    setTimeout(() => stopTyping(key, userId), TYPING_TTL),
  );
}

/** Someone stopped typing, for example because their message arrived. */
export function stopTyping(key: string, userId: string) {
  clearTimeout(expiries.get(`${key}|${userId}`));
  expiries.delete(`${key}|${userId}`);
  const existing = typing.get(key) ?? [];
  if (!existing.includes(userId)) return;
  const next = new Map(typing);
  const rest = existing.filter((u) => u !== userId);
  if (rest.length) next.set(key, rest);
  else next.delete(key);
  publishTyping(next);
}

export function registerTypingSender(fn: ((to: string) => void) | null) {
  sender = fn;
}

let lastSent = 0;
/** Tells the others you are typing; `to` is "squad" or the other member's id. Throttled. */
export function announceTyping(to: string) {
  const now = Date.now();
  if (!sender || now - lastSent < 2000) return;
  lastSent = now;
  sender(to);
}

const EMPTY: readonly string[] = [];
function subscribeTyping(listener: () => void) {
  typingListeners.add(listener);
  return () => typingListeners.delete(listener);
}

/** Member ids typing in a conversation right now. */
export function useTyping(key: string): readonly string[] {
  return useSyncExternalStore(
    subscribeTyping,
    () => typing.get(key) ?? EMPTY,
    () => EMPTY,
  );
}
