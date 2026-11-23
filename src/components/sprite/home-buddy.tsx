"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";
import type { SpriteAnim, SpriteSheet } from "@/lib/sprites";
import { Sprite } from "./sprite";
import { SPLASH_OPEN_EVENT } from "./welcome-splash";

export type BuddyStatus = "sleep" | "busy" | "done";

const LABEL: Record<BuddyStatus, string> = {
  sleep: "nog niet ingecheckt",
  busy: "bezig met vandaag",
  done: "alles afgevinkt vandaag",
};

/**
 * Your character on Home. It shows how your day goes: asleep until you check
 * in, standing (with a wave now and then) while you are busy, jumping once
 * every daily habit is done. Tap it to hear today's line again.
 */
export function HomeBuddy({ sheet, status, canTalk }: { sheet: SpriteSheet; status: BuddyStatus; canTalk: boolean }) {
  const reduce = useReducedMotion() ?? false;
  const [waving, setWaving] = useState(false);

  // While busy: wave for two seconds every eight.
  useEffect(() => {
    if (status !== "busy" || reduce) return;
    const id = setInterval(() => {
      setWaving(true);
      setTimeout(() => setWaving(false), 2000);
    }, 8000);
    return () => clearInterval(id);
  }, [status, reduce]);

  const anim: SpriteAnim = status === "sleep" ? "sleep" : status === "done" ? "happy" : waving ? "wave" : "stand";
  const sprite = <Sprite sheet={sheet} anim={anim} height={78} />;
  if (!canTalk) return <div aria-label={`Je poppetje: ${LABEL[status]}`} role="img">{sprite}</div>;
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(SPLASH_OPEN_EVENT))}
      className="-mb-1 rounded-[18px] transition-transform active:scale-95"
      aria-label={`Je poppetje, ${LABEL[status]}. Tik voor je bericht van vandaag.`}
    >
      {sprite}
    </button>
  );
}
