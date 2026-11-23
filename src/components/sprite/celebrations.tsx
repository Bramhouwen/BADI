"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CELEBRATE_EVENT, celebrationText, clearPendingCelebration, takePendingCelebration, type Celebration } from "@/lib/celebrate";
import type { SpriteSheet } from "@/lib/sprites";
import { Confetti } from "@/components/wheel/confetti";
import { Sprite } from "./sprite";
import { useBuddyPrefs } from "@/lib/buddy-prefs";

/**
 * Plays a celebration: your character jumps in at the bottom of the screen
 * with a short line and confetti, then leaves. Tap to close it sooner. It
 * never blocks the page underneath.
 */
export function Celebrations({ sheet }: { sheet: SpriteSheet }) {
  const reduce = useReducedMotion() ?? false;
  const prefs = useBuddyPrefs();
  const [current, setCurrent] = useState<(Celebration & { id: number }) | null>(null);

  useEffect(() => {
    const on = (e: Event) => {
      clearPendingCelebration();
      setCurrent({ ...(e as CustomEvent<Celebration>).detail, id: Date.now() });
    };
    window.addEventListener(CELEBRATE_EVENT, on);
    // One that fired before this overlay was mounted.
    const pending = takePendingCelebration();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (pending) setCurrent({ ...pending, id: Date.now() });
    return () => window.removeEventListener(CELEBRATE_EVENT, on);
  }, []);

  useEffect(() => {
    if (!current) return;
    const id = setTimeout(() => setCurrent(null), 4200);
    return () => clearTimeout(id);
  }, [current]);

  const shown = current && prefs.celebrate ? celebrationText(current) : null;

  return (
    <AnimatePresence>
      {current && shown ? (
        <motion.div key={current.id} className="pointer-events-none fixed inset-0 z-[66]" exit={{ opacity: 0, transition: { duration: 0.3 } }}>
          <Confetti key={current.id} pieces={60} />
          <div className="absolute inset-x-0 mx-auto flex max-w-md flex-col items-center px-4" style={{ bottom: "calc(var(--nav-h) + var(--sab) + 24px)" }}>
            <motion.button
              type="button"
              onClick={() => setCurrent(null)}
              className="pointer-events-auto flex flex-col items-center"
              aria-label={`${shown.text} Tik om te sluiten.`}
              initial={reduce ? { opacity: 0 } : { y: 80, opacity: 0, scale: 0.8 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
            >
              <span className="mb-1 max-w-[260px] rounded-[20px] bg-white px-4 py-2.5 text-center text-[15px] font-semibold leading-snug text-text shadow-[0_14px_30px_-18px_rgba(95,53,41,0.6)] ring-1 ring-ink/[0.06]" role="status">
                {shown.text}
              </span>
              <Sprite sheet={sheet} anim={shown.anim} height={150} />
            </motion.button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
