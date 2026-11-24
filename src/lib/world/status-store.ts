/**
 * Your status in World of Badi ("wat ben je aan het doen"), remembered on this
 * device. Picked on the Squad card before you go in, or in the world itself;
 * both read and write the same place.
 */
import { STATUSES, type StatusKey } from "./engine/presence";

const key = (userId: string) => `wereld-status:${userId}`;

export function readSavedStatus(userId: string): StatusKey | null {
  try {
    const v = localStorage.getItem(key(userId));
    return v && Object.hasOwn(STATUSES, v) ? (v as StatusKey) : null;
  } catch {
    return null;
  }
}

export function saveStatus(userId: string, status: StatusKey | null): void {
  try {
    if (status) localStorage.setItem(key(userId), status);
    else localStorage.removeItem(key(userId));
  } catch {}
}
