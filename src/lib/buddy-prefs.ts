/**
 * Per-device settings for your character: the card on Home, celebrations and
 * walking in with messages. Stored in this browser only; everything is on
 * unless switched off.
 */
import { useSyncExternalStore } from "react";

export interface BuddyPrefs {
  card: boolean;
  celebrate: boolean;
  messages: boolean;
}

export const DEFAULT_BUDDY_PREFS: BuddyPrefs = { card: true, celebrate: true, messages: true };

const KEY = "badi:buddy-prefs";
const EVENT = "badi:buddy-prefs";

export function readBuddyPrefs(): BuddyPrefs {
  if (typeof window === "undefined") return DEFAULT_BUDDY_PREFS;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_BUDDY_PREFS, ...(JSON.parse(raw) as Partial<BuddyPrefs>) } : DEFAULT_BUDDY_PREFS;
  } catch {
    return DEFAULT_BUDDY_PREFS;
  }
}

export function writeBuddyPrefs(next: BuddyPrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private mode: the setting lasts until the page closes.
  }
  cached = null;
  window.dispatchEvent(new Event(EVENT));
}

let cached: { raw: string | null; value: BuddyPrefs } | null = null;

function snapshot(): BuddyPrefs {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {}
  if (!cached || cached.raw !== raw) cached = { raw, value: readBuddyPrefs() };
  return cached.value;
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useBuddyPrefs(): BuddyPrefs {
  return useSyncExternalStore(subscribe, snapshot, () => DEFAULT_BUDDY_PREFS);
}
