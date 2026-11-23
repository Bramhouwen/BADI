"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronRight } from "lucide-react";
import type { SpriteAnim, SpriteSheet } from "@/lib/sprites";
import type { BuddyBrief } from "@/lib/welcome";
import { useBuddyPrefs } from "@/lib/buddy-prefs";
import { cn } from "@/lib/utils";
import { Sprite } from "./sprite";

export type BuddyStatus = "sleep" | "busy" | "done";

const STATUS_LABEL: Record<BuddyStatus, string> = {
  sleep: "nog niet ingecheckt",
  busy: "bezig met vandaag",
  done: "alles afgevinkt vandaag",
};

const STATUS_ANIM: Record<BuddyStatus, SpriteAnim> = { sleep: "sleep", busy: "stand", done: "happy" };

/**
 * Your character's fixed place on Home: it stands next to a speech bubble with
 * today's news, wins and squad updates (never a to-do). The first time you
 * open Home on a day it walks in and tells it; after that it shows how your
 * day goes. Tap it to make it react.
 */
export function BuddyCard({ sheet, status, brief, dayKey }: { sheet: SpriteSheet; status: BuddyStatus; brief: BuddyBrief; dayKey: string }) {
  const prefs = useBuddyPrefs();
  const reduce = useReducedMotion() ?? false;
  const [entrance, setEntrance] = useState(false);
  const [telling, setTelling] = useState(false);

  // First visit of the day: walk in and tell the news.
  useEffect(() => {
    let first = false;
    try {
      first = localStorage.getItem("badi:buddy-day") !== dayKey;
      localStorage.setItem("badi:buddy-day", dayKey);
    } catch {}
    if (!first || reduce) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEntrance(true);
    setTelling(true);
    const t = setTimeout(() => setTelling(false), 5000);
    return () => clearTimeout(t);
  }, [dayKey, reduce]);

  function react() {
    setTelling(true);
    setTimeout(() => setTelling(false), 2600);
  }

  if (!prefs.card) return null;
  const anim: SpriteAnim = telling ? brief.anim : STATUS_ANIM[status];

  return (
    <section aria-label="Je poppetje" className="flex items-end gap-2">
      <motion.button
        type="button"
        onClick={react}
        className="relative -mb-1 shrink-0 rounded-[18px] active:scale-95"
        aria-label={`Je poppetje, ${STATUS_LABEL[status]}`}
        initial={entrance ? { x: -120, opacity: 0 } : false}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 1.1, ease: [0.22, 0.8, 0.3, 1] }}
      >
        <Sprite sheet={sheet} anim={anim} height={104} />
        <span className="absolute bottom-1 left-1/2 -z-10 h-2.5 w-16 -translate-x-1/2 rounded-[50%] bg-ink/12 blur-[2px]" aria-hidden />
      </motion.button>

      <div className="relative mb-4 min-w-0 flex-1 rounded-[22px] rounded-bl-[6px] bg-white/90 px-3.5 py-3 shadow-[0_14px_30px_-22px_rgba(95,53,41,0.55)] ring-1 ring-ink/[0.05]">
        {brief.items.length === 0 ? (
          <p className="text-[13px] text-muted">Geen nieuws vandaag.</p>
        ) : (
          <ul className="space-y-1.5">
            <AnimatePresence initial={entrance}>
              {brief.items.map((item, i) => {
                const body = (
                  <>
                    <span className="w-5 shrink-0 text-center text-[15px] leading-5" aria-hidden>
                      {item.icon}
                    </span>
                    <span className="min-w-0 flex-1 text-[13.5px] leading-5 text-text">{item.text}</span>
                    {item.href ? <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted" strokeWidth={1.8} aria-hidden /> : null}
                  </>
                );
                return (
                  <motion.li
                    key={item.text}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: entrance ? 0.9 + i * 0.25 : 0, duration: 0.3 }}
                  >
                    {item.href ? (
                      <Link href={item.href} className={cn("-mx-1.5 flex items-start gap-2 rounded-[12px] px-1.5 py-0.5 hover:bg-blush/50")}>
                        {body}
                      </Link>
                    ) : (
                      <div className="flex items-start gap-2 py-0.5">{body}</div>
                    )}
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </section>
  );
}
