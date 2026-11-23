/**
 * Celebration moments: your own character reacts to what you just did.
 * Call celebrate() in the browser right after the action succeeded; the
 * Celebrations overlay in the app layout plays it (members without a
 * character see nothing).
 */
import { WEEKLY_STEPS_GOAL } from "./checkin-plan";
import type { SpriteAnim } from "./sprites";

export type CelebrationKind = "day" | "steps" | "workout" | "streak";

export const CELEBRATE_EVENT = "badi:celebrate";

export interface Celebration {
  kind: CelebrationKind;
  /** Streak length for "streak". */
  n?: number;
}

type Pending = { detail: Celebration; at: number };
const holder = () => window as unknown as { __badiCelebration?: Pending };

export function celebrate(kind: CelebrationKind, n?: number) {
  if (typeof window === "undefined") return;
  // Kept for a moment, for an overlay that mounts just after (a full page load).
  holder().__badiCelebration = { detail: { kind, n }, at: Date.now() };
  window.dispatchEvent(new CustomEvent<Celebration>(CELEBRATE_EVENT, { detail: { kind, n } }));
}

/** A celebration from the last few seconds that no overlay picked up yet. */
export function takePendingCelebration(): Celebration | null {
  if (typeof window === "undefined") return null;
  const p = holder().__badiCelebration;
  holder().__badiCelebration = undefined;
  return p && Date.now() - p.at < 4000 ? p.detail : null;
}

/** The overlay took this one. */
export function clearPendingCelebration() {
  if (typeof window !== "undefined") holder().__badiCelebration = undefined;
}

/** Streak lengths worth a celebration: every full week. */
export function isStreakMilestone(n: number): boolean {
  return n >= 7 && n % 7 === 0;
}

export function celebrationText({ kind, n }: Celebration): { text: string; anim: SpriteAnim } {
  switch (kind) {
    case "day":
      return { text: "Alles afgevinkt vandaag! 🎉", anim: "happy" };
    case "steps":
      return { text: `${new Intl.NumberFormat("nl-NL").format(WEEKLY_STEPS_GOAL)} stappen! Je weekdoel is binnen.`, anim: "cheer" };
    case "workout":
      return { text: "Training staat erop! 💪", anim: "squat" };
    case "streak":
      return { text: `${n ?? 7} dagen op rij ingecheckt! 🔥`, anim: "cheer" };
  }
}
