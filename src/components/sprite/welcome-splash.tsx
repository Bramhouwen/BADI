"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { WelcomeMessage } from "@/lib/welcome";
import type { SpriteSheet } from "@/lib/sprites";
import { Sprite } from "./sprite";

const STORAGE_KEY = "badi:welcome";

function seenToday(key: string): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === key;
  } catch {
    return false;
  }
}

function markSeen(key: string) {
  try {
    localStorage.setItem(STORAGE_KEY, key);
  } catch {
    // Private mode: the splash may show again, which is harmless.
  }
}

/** Types `text` out letter by letter once `start` is true. */
function useTyped(text: string, start: boolean, instant: boolean): string {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!start || instant) return;
    const id = setInterval(() => setN((v) => (v >= text.length ? v : v + 1)), 28);
    return () => clearInterval(id);
  }, [start, instant, text]);
  if (instant) return start ? text : "";
  return text.slice(0, n);
}

/**
 * Your own character walks in once a day, the first time you open Home, and
 * says hello with a line about your day. Tap anywhere to continue.
 */
export function WelcomeSplash({ userId, date, sheet, message }: { userId: string; date: string; sheet: SpriteSheet; message: WelcomeMessage }) {
  const reduce = useReducedMotion() ?? false;
  const key = `${userId}:${date}`;
  const [open, setOpen] = useState(false);
  const [talking, setTalking] = useState(false);

  useEffect(() => {
    if (seenToday(key)) return;
    markSeen(key);
    // Opening from an effect: the splash depends on this browser's storage.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(true);
  }, [key]);

  // Start talking once the character has walked in.
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => setTalking(true), reduce ? 0 : 1500);
    return () => clearTimeout(id);
  }, [open, reduce]);

  const greeting = useTyped(message.greeting, talking, reduce);
  const lineStart = talking && greeting.length === message.greeting.length;
  const line = useTyped(message.line, lineStart, reduce);
  const done = line.length === message.line.length;

  function close() {
    setOpen(false);
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-[#f6ede6]/85 px-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label={`${message.greeting} ${message.line}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.25 } }}
          onClick={close}
        >
          <div className="flex w-full max-w-sm flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <div className="relative min-h-[132px] w-full">
              <AnimatePresence>
                {talking ? (
                  <motion.div
                    className="relative w-full rounded-[26px] bg-white px-5 py-4 shadow-[0_18px_40px_-24px_rgba(95,53,41,0.55)] ring-1 ring-ink/[0.06]"
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: "spring", stiffness: 320, damping: 24 }}
                  >
                    <p className="font-display text-[22px] leading-tight text-text" aria-hidden>
                      {greeting}
                      {!lineStart ? <span className="ml-0.5 inline-block w-[2px] animate-pulse bg-ink/60">&nbsp;</span> : null}
                    </p>
                    <p className="mt-2 min-h-[42px] text-[15px] leading-snug text-muted" aria-hidden>
                      {line}
                    </p>
                    <span className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 bg-white ring-1 ring-ink/[0.06] [clip-path:polygon(100%_0,100%_100%,0_100%)]" aria-hidden />
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            <motion.div
              className="relative mt-4"
              initial={reduce ? false : { x: "-75vw" }}
              animate={{ x: 0 }}
              transition={{ duration: 1.4, ease: [0.22, 0.8, 0.3, 1] }}
            >
              <Sprite sheet={sheet} anim={talking ? message.anim : "walk"} height={220} />
              <span className="absolute bottom-1 left-1/2 -z-10 h-4 w-28 -translate-x-1/2 rounded-[50%] bg-ink/15 blur-[3px]" aria-hidden />
            </motion.div>

            <motion.div className="mt-6 flex w-full flex-col gap-2.5" initial={{ opacity: 0 }} animate={{ opacity: done ? 1 : 0 }} transition={{ duration: 0.3 }}>
              {message.action ? (
                <Link href={message.action.href} onClick={close} className="espresso flex h-[52px] w-full items-center justify-center rounded-full text-[15px] font-semibold">
                  {message.action.label}
                </Link>
              ) : null}
              <button
                type="button"
                onClick={close}
                className={message.action ? "h-11 w-full rounded-full text-[14px] font-medium text-muted hover:bg-white/60" : "espresso h-[52px] w-full rounded-full text-[15px] font-semibold"}
              >
                Naar vandaag
              </button>
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
