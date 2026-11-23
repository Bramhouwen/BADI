"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, SendHorizontal, Users, X } from "lucide-react";
import { SCENES, FIRST_SCENE } from "@/lib/world/scenes";
import type { Door } from "@/lib/world/engine/scene";
import { SPEECH_MAX, type WorldPresence } from "@/lib/world/engine/presence";
import { relativeTimeNl } from "@/lib/dates";
import { WorldCanvas, type PickedMember, type WorldCanvasApi, type WorldMember } from "./world-canvas";
import { createWorldLink, type WorldLink } from "./world-link";

const FADE_MS = 220;

/**
 * BADI Wereld, over the whole screen like a game: the scene you are in, a
 * back button and the name of the room on top, who is online, and a line to
 * say something to everyone in the room. A door fades the picture out, the
 * next scene starts at the door you come out of and fades in once it is
 * drawn. All backgrounds are loaded up front, so a door opens right away.
 */
export function WorldView({
  me,
  challengeId,
  startScene,
  startX = null,
  startY = null,
  restore = null,
  members = [],
  debug = false,
  overlay = false,
  edit = false,
  notice = null,
}: {
  me: { id: string; name: string; character: string | null };
  challengeId: string;
  startScene: string;
  startX?: number | null;
  startY?: number | null;
  /** The seat or spot you were on when you left. */
  restore?: string | null;
  /** Everyone else in the group with their last place in the world. */
  members?: WorldMember[];
  debug?: boolean;
  overlay?: boolean;
  edit?: boolean;
  /** A line shown under the room name, for example when positions are not saved. */
  notice?: string | null;
}) {
  const [here, setHere] = useState(() => ({ scene: SCENES[startScene] ? startScene : FIRST_SCENE, arrive: null as string | null, n: 0 }));
  const [dim, setDim] = useState(false);
  const [link, setLink] = useState<WorldLink | null>(null);
  const [peers, setPeers] = useState<[string, WorldPresence][]>([]);
  const [showWho, setShowWho] = useState(false);
  const [picked, setPicked] = useState<PickedMember | null>(null);
  const [text, setText] = useState("");
  const lastSaid = useRef(0);
  const canvasApi = useRef<WorldCanvasApi | null>(null);
  // The part of the screen you can see: smaller while the keyboard is open.
  const [visible, setVisible] = useState<{ top: number; height: number; keyboard: boolean } | null>(null);

  useEffect(() => {
    const v = window.visualViewport;
    if (!v) return;
    const update = () => setVisible({ top: v.offsetTop, height: v.height, keyboard: window.innerHeight - v.height > 120 });
    v.addEventListener("resize", update);
    v.addEventListener("scroll", update);
    return () => {
      v.removeEventListener("resize", update);
      v.removeEventListener("scroll", update);
    };
  }, []);

  // The page underneath never scrolls: the world stays put when the keyboard opens.
  useEffect(() => {
    const html = document.documentElement, body = document.body;
    const before = [html.style.overflow, body.style.overflow];
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = before[0];
      body.style.overflow = before[1];
    };
  }, []);

  useEffect(() => {
    for (const s of Object.values(SCENES)) {
      const img = new Image();
      img.decoding = "async";
      img.src = s.background;
    }
  }, []);

  // One live link for the whole visit, through every door. Not in the placement mode.
  useEffect(() => {
    if (edit) return;
    const l = createWorldLink(me.id, challengeId);
    const off = l.subscribe((e) => {
      if (e.type === "peers") setPeers([...l.peers()]);
    });
    // Hand it to the canvas on the next frame, after this effect.
    const frame = requestAnimationFrame(() => setLink(l));
    return () => {
      cancelAnimationFrame(frame);
      off();
      l.close();
      setLink(null);
    };
  }, [edit, me.id, challengeId]);

  const onDoor = (door: Door) => {
    const to = door.to;
    if (!to || !SCENES[to]) return;
    setDim(true);
    setPicked(null);
    setTimeout(() => setHere((h) => ({ scene: to, arrive: door.arrive ?? null, n: h.n + 1 })), FADE_MS);
  };

  const scene = SCENES[here.scene];
  const first = here.n === 0;
  const online = new Set(peers.map(([id]) => id));
  const offline = members.filter((m) => !online.has(m.id));

  const send = () => {
    const now = Date.now();
    if (!link || !text.trim() || now - lastSaid.current < 1200) return;
    lastSaid.current = now;
    link.say(here.scene, text);
    setText("");
  };

  return (
    <div
      className="fixed inset-x-0 top-0 z-40 overflow-hidden overscroll-none bg-[#f6ece4]"
      // Follows the visible part of the screen, so the world shrinks above the keyboard instead of sliding away.
      style={visible ? { top: visible.top, height: visible.height } : { bottom: 0 }}
    >
      <div className="absolute inset-0" style={{ opacity: dim ? 0 : 1, transition: `opacity ${FADE_MS}ms ease` }}>
        {edit || link ? (
          <WorldCanvas
            key={here.n}
            scene={scene}
            me={me}
            startX={first ? startX : null}
            startY={first ? startY : null}
            restore={first ? restore : null}
            arriveAt={here.arrive}
            link={link}
            members={members}
            debug={debug}
            overlay={overlay}
            edit={edit}
            onDoor={onDoor}
            onReady={() => setDim(false)}
            onPick={setPicked}
            apiRef={canvasApi}
          />
        ) : null}
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start gap-2 px-3" style={{ paddingTop: "calc(var(--sat) + 12px)" }}>
        <Link
          href="/"
          aria-label="Terug naar de app"
          className="pointer-events-auto grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/90 text-ink shadow-md ring-1 ring-ink/[0.06] backdrop-blur"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </Link>
        <div className="min-w-0 rounded-full bg-white/90 px-4 py-2 shadow-md ring-1 ring-ink/[0.06] backdrop-blur">
          <p className="truncate text-[14px] font-semibold leading-tight text-text">{scene.name}</p>
          {edit || notice ? <p className="truncate text-[11.5px] leading-tight text-muted">{edit ? "Zitplekken plaatsen" : notice}</p> : null}
        </div>
        {!edit ? (
          <button
            type="button"
            onClick={() => setShowWho((v) => !v)}
            aria-expanded={showWho}
            className="pointer-events-auto ml-auto flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-white/90 px-3.5 text-[13.5px] font-semibold text-ink shadow-md ring-1 ring-ink/[0.06] backdrop-blur"
          >
            <Users className="h-4 w-4" aria-hidden />
            {peers.length + 1} online
          </button>
        ) : null}
      </div>

      {showWho && !edit ? (
        <div className="absolute right-3 w-[min(280px,calc(100vw-24px))] rounded-[18px] bg-white/95 p-3 shadow-lg ring-1 ring-ink/[0.06] backdrop-blur" style={{ top: "calc(var(--sat) + 64px)" }}>
          <ul className="space-y-1.5 text-[13.5px]">
            <li className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-[#3f8f4f]" aria-hidden />
              <span className="font-semibold text-text">Jij</span>
              <span className="ml-auto truncate text-muted">{scene.name}</span>
            </li>
            {peers.map(([id, p]) => (
              <li key={id} className="flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full bg-[#3f8f4f]" aria-hidden />
                <span className="font-semibold text-text">{p.name}</span>
                <span className="ml-auto truncate text-muted">{SCENES[p.scene]?.name ?? "In de wereld"}</span>
              </li>
            ))}
            {offline.map((m) => (
              <li key={m.id} className="flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full bg-ink/20" aria-hidden />
                <span className="text-text">{m.name}</span>
                <span className="ml-auto truncate text-muted">{m.updatedAt ? `offline · ${relativeTimeNl(m.updatedAt)}` : "nog niet geweest"}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!edit ? (
        <div className="absolute inset-x-3 mx-auto max-w-md space-y-2" style={{ bottom: visible?.keyboard ? 8 : "calc(var(--sab) + 12px)" }}>
          {picked ? (
            <div className="flex items-center gap-3 rounded-[18px] bg-white/95 px-4 py-3 shadow-lg ring-1 ring-ink/[0.06] backdrop-blur" role="status">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${picked.online ? "bg-[#3f8f4f]" : "bg-ink/20"}`} aria-hidden />
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-text">{picked.name}</p>
                <p className="truncate text-[12.5px] text-muted">{picked.online ? "Online" : picked.lastSeen ? `Offline · ${relativeTimeNl(picked.lastSeen)}` : "Offline"}</p>
              </div>
              <button type="button" onClick={() => setPicked(null)} aria-label="Sluiten" className="ml-auto grid h-9 w-9 place-items-center rounded-full text-muted">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ) : null}
          <form
            className="flex items-center gap-2 rounded-full bg-white/95 p-1.5 pl-4 shadow-lg ring-1 ring-ink/[0.06] backdrop-blur"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={SPEECH_MAX}
              enterKeyHint="send"
              placeholder="Zeg iets…"
              aria-label={`Zeg iets tegen iedereen in ${scene.name}`}
              onFocus={() => {
                setShowWho(false);
                canvasApi.current?.focusMe();
              }}
              // 16px or more, so a phone does not zoom the page in when you tap the field.
              className="min-w-0 flex-1 bg-transparent text-[16px] text-text outline-none placeholder:text-muted"
            />
            <button type="submit" disabled={!text.trim()} aria-label="Zeg het" className="espresso grid h-10 w-10 shrink-0 place-items-center rounded-full disabled:opacity-40">
              <SendHorizontal className="h-4.5 w-4.5" aria-hidden />
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
