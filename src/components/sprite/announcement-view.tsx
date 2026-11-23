"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Sparkles } from "lucide-react";
import type { WelcomeMessage } from "@/lib/welcome";
import type { SpriteSheet } from "@/lib/sprites";
import { Confetti } from "@/components/wheel/confetti";
import type { AnnouncementContent } from "./welcome-splash";
import { Sprite } from "./sprite";
import { useTyped } from "./use-typed";

const CONFETTI = ["#f3d488", "#e2b656", "#fbf3ec", "#cf9a7c", "#8c9e7a", "#7fa3bd"];

/**
 * The big announcement: a dark full screen with confetti, the character
 * jumping in and introducing itself, then a short list of what it does.
 */
export function AnnouncementView({ sheet, message, content, onClose }: { sheet: SpriteSheet; message: WelcomeMessage; content: AnnouncementContent; onClose: () => void }) {
  const reduce = useReducedMotion() ?? false;
  const [talking, setTalking] = useState(false);
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    const id = setTimeout(() => setTalking(true), reduce ? 0 : 1100);
    return () => clearTimeout(id);
  }, [reduce]);

  const greeting = useTyped(message.greeting, talking, reduce, 45);
  const lineStart = talking && greeting.length === message.greeting.length;
  const line = useTyped(message.line, lineStart, reduce, 24);
  const done = line.length === message.line.length;

  // A second burst of confetti when the list appears.
  useEffect(() => {
    if (!done || reduce) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBurst((b) => b + 1);
  }, [done, reduce]);

  return (
    <motion.div
      className="fixed inset-0 z-[70] overflow-y-auto bg-[radial-gradient(ellipse_at_top,#7a4636_0%,#4a2c22_45%,#2e1d18_100%)] text-[#fbf3ec]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="announcement-title"
      aria-describedby="announcement-text"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
    >
      <Confetti key="start" pieces={130} colors={CONFETTI} />
      {burst > 0 ? <Confetti key={`burst-${burst}`} pieces={70} colors={CONFETTI} /> : null}

      <div className="mx-auto flex min-h-full max-w-md flex-col items-center px-4 pb-[calc(24px+var(--sab))] pt-[calc(28px+var(--sat))]">
        <motion.p
          className="flex items-center gap-1.5 rounded-full bg-[#f3d488]/15 px-3 py-1 text-[11.5px] font-semibold uppercase tracking-[0.22em] text-[#f3d488] ring-1 ring-[#f3d488]/40"
          initial={reduce ? false : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Sparkles className="h-3.5 w-3.5" strokeWidth={2} aria-hidden /> {content.label}
        </motion.p>
        <motion.h1
          id="announcement-title"
          className="mt-3 text-center font-display text-[38px] leading-[1.05] text-[#fbf3ec]"
          initial={reduce ? false : { opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25, type: "spring", stiffness: 220, damping: 18 }}
        >
          {content.title}
        </motion.h1>

        <div className="mt-5 flex w-full items-end gap-2">
          <motion.div
            className="relative shrink-0"
            initial={reduce ? false : { y: 140, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.35, type: "spring", stiffness: 180, damping: 14 }}
          >
            <span className="absolute inset-x-2 bottom-0 top-6 -z-10 rounded-full bg-[#f3d488]/25 blur-2xl" aria-hidden />
            <Sprite sheet={sheet} anim={done ? "cheer" : talking ? "wave" : "happy"} height={150} />
          </motion.div>
          <div className="mb-10 min-h-[120px] flex-1">
            {talking ? (
              <motion.div
                className="relative rounded-[22px] rounded-bl-[6px] bg-[#fbf7f2] px-4 py-3 text-text shadow-[0_18px_40px_-20px_rgba(0,0,0,0.6)]"
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9, x: -8 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                transition={{ type: "spring", stiffness: 320, damping: 22 }}
              >
                <p className="font-display text-[22px] leading-tight" aria-hidden>
                  {greeting}
                </p>
                <p className="mt-1 text-[14px] leading-snug text-muted" aria-hidden>
                  {line}
                </p>
              </motion.div>
            ) : null}
          </div>
        </div>
        <p id="announcement-text" className="sr-only">
          {message.greeting} {message.line} {content.intro} {content.features.map((f) => `${f.title}: ${f.body}`).join(" ")}
        </p>

        <motion.div className="mt-4 w-full" initial={{ opacity: 0 }} animate={{ opacity: done ? 1 : 0 }} transition={{ duration: 0.3 }} aria-hidden={!done}>
          <p className="text-center text-[14px] font-medium text-[#fbf3ec]/85">{content.intro}</p>
          <ul className="mt-3 space-y-2.5">
            {content.features.map((f, i) => (
              <motion.li
                key={f.title}
                className="flex items-start gap-3 rounded-[20px] bg-white/[0.08] p-3.5 ring-1 ring-white/15"
                initial={reduce ? false : { opacity: 0, y: 16 }}
                animate={done ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
                transition={{ delay: reduce ? 0 : 0.15 + i * 0.18, type: "spring", stiffness: 260, damping: 24 }}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f3d488]/20 text-[20px]" aria-hidden>
                  {f.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold text-[#fbf3ec]">{f.title}</span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-[#fbf3ec]/75">{f.body}</span>
                </span>
              </motion.li>
            ))}
          </ul>
        </motion.div>

        <motion.button
          type="button"
          onClick={onClose}
          className="mt-6 h-[54px] w-full shrink-0 rounded-full bg-[#f3d488] text-[16px] font-semibold text-[#3b2a24] shadow-[0_14px_30px_-14px_rgba(243,212,136,0.7)] transition-transform active:scale-[0.98]"
          style={{ pointerEvents: done ? "auto" : "none", color: "#3b2a24" }}
          tabIndex={done ? 0 : -1}
          initial={{ opacity: 0 }}
          animate={{ opacity: done ? 1 : 0 }}
          transition={{ delay: done && !reduce ? 0.15 + content.features.length * 0.18 : 0 }}
        >
          {content.cta}
        </motion.button>
        {!done ? (
          <button type="button" onClick={onClose} className="mt-2 text-[13px] text-[#fbf3ec]/60 underline-offset-2 hover:underline">
            Overslaan
          </button>
        ) : null}
      </div>
    </motion.div>
  );
}
