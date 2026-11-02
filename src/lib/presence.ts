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
