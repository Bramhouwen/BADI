"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createClient } from "@/lib/supabase/client";
import { isDemo } from "@/lib/demo";
import type { SpriteSheet } from "@/lib/sprites";
import { Sprite } from "./sprite";
import { useBuddyPrefs } from "@/lib/buddy-prefs";

type Sender = { id: string; name: string; sheet: SpriteSheet };
type Incoming = { key: string; sender: Sender; text: string; href: string };
type Row = { id?: string; user_id?: string; recipient_id?: string | null; body?: string | null; is_coach?: boolean | null; attachment_type?: string | null; mentions?: string[] | null };

/** Demo only: window.dispatchEvent(new CustomEvent("badi:demo-message", { detail: row })) plays an incoming message. */
export const DEMO_MESSAGE_EVENT = "badi:demo-message";

function preview(row: Row): string {
  const body = (row.body ?? "").trim();
  if (body) return body.length > 90 ? `${body.slice(0, 88)}…` : body;
  if (row.attachment_type === "image") return "stuurde een foto";
  if (row.attachment_type === "recipe") return "deelde een recept";
  if (row.attachment_type === "post") return "deelde een foto van de Wall";
  if (row.attachment_type === "file") return "stuurde een bestand";
  return "stuurde een bericht";
}

/**
 * When a squad member with a character sends you a private message or
 * mentions you in the group, their character walks in at the bottom of the screen with the
 * message in a speech bubble. Tap it to open the chat. Not shown while that
 * chat is already open.
 */
export function MessageSprite({ me, challengeId, senders }: { me: string; challengeId: string; senders: Sender[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const reduce = useReducedMotion() ?? false;
  const [current, setCurrent] = useState<Incoming | null>(null);
  const [arrived, setArrived] = useState(false);
  const pathRef = useRef(pathname);
  const sendersRef = useRef(senders);
  const prefs = useBuddyPrefs();
  const prefsRef = useRef(prefs);

  useEffect(() => {
    pathRef.current = pathname;
    sendersRef.current = senders;
    prefsRef.current = prefs;
  });

  useEffect(() => {
    function receive(row: Row) {
      if (!row?.id || !row.user_id || row.user_id === me || row.is_coach) return;
      const isPrivate = Boolean(row.recipient_id);
      if (isPrivate && row.recipient_id !== me) return;
      // In the group only when you are mentioned; every group message would be too much.
      if (!isPrivate && !(row.mentions ?? []).includes(me)) return;
      if (!prefsRef.current.messages) return;
      const sender = sendersRef.current.find((s) => s.id === row.user_id);
      if (!sender) return;
      const href = isPrivate ? `/squad/chat/${sender.id}` : "/squad/chat";
      if (pathRef.current === href) return;
      setArrived(false);
      setCurrent({ key: row.id, sender, text: preview(row), href });
    }

    const onDemo = (e: Event) => receive((e as CustomEvent<Row>).detail);
    if (isDemo()) {
      window.addEventListener(DEMO_MESSAGE_EVENT, onDemo);
      return () => window.removeEventListener(DEMO_MESSAGE_EVENT, onDemo);
    }
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      return;
    }
    const ch = supabase
      .channel(`sprite-messages:${challengeId}:${me}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "squad_messages", filter: `challenge_id=eq.${challengeId}` }, (payload) => receive(payload.new as Row))
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [me, challengeId]);

  // Walk in, wave, and leave after a while.
  useEffect(() => {
    if (!current) return;
    const land = setTimeout(() => setArrived(true), reduce ? 0 : 1100);
    const leave = setTimeout(() => setCurrent(null), 8000);
    return () => {
      clearTimeout(land);
      clearTimeout(leave);
    };
  }, [current, reduce]);

  function open() {
    if (!current) return;
    const href = current.href;
    setCurrent(null);
    router.push(href);
  }

  return (
    <AnimatePresence>
      {current ? (
        <motion.div
          key={current.key}
          className="pointer-events-none fixed left-0 right-0 z-[65] mx-auto flex max-w-md items-end px-3"
          style={{ bottom: "calc(var(--nav-h) + var(--sab) + 14px)" }}
          exit={{ opacity: 0, y: 12, transition: { duration: 0.25 } }}
        >
          <motion.button
            type="button"
            onClick={open}
            className="pointer-events-auto flex items-end gap-1 text-left"
            aria-label={`Nieuw bericht van ${current.sender.name}: “${current.text}”. Open de chat.`}
            initial={reduce ? { opacity: 0 } : { x: "-60vw" }}
            animate={reduce ? { opacity: 1 } : { x: 0 }}
            transition={{ duration: 1.1, ease: [0.22, 0.8, 0.3, 1] }}
          >
            <Sprite sheet={current.sender.sheet} anim={arrived ? "wave" : "walk"} height={118} />
            <AnimatePresence>
              {arrived ? (
                <motion.span
                  className="relative mb-12 max-w-[230px] rounded-[20px] rounded-bl-[6px] bg-white px-3.5 py-2.5 shadow-[0_14px_30px_-18px_rgba(95,53,41,0.6)] ring-1 ring-ink/[0.06]"
                  initial={{ opacity: 0, scale: 0.9, x: -6 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  transition={{ type: "spring", stiffness: 340, damping: 24 }}
                >
                  <span className="block text-[12px] font-semibold text-ink">{current.sender.name}</span>
                  <span className="line-clamp-2 block text-[13.5px] leading-snug text-text">{current.text}</span>
                </motion.span>
              ) : null}
            </AnimatePresence>
          </motion.button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
