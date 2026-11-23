"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Footprints, Hand, Lock, Mail, SendHorizontal, X } from "lucide-react";
import { SCENES, FIRST_SCENE } from "@/lib/world/scenes";
import type { Door } from "@/lib/world/engine/scene";
import { SPEECH_MAX, type WorldPresence } from "@/lib/world/engine/presence";
import { relativeTimeNl } from "@/lib/dates";
import { WorldCanvas, type PickedMember, type WorldCanvasApi, type WorldMember } from "./world-canvas";
import { createWorldLink, type WorldLink } from "./world-link";
import { WorldPostBox, WorldThread, useLiveDms } from "./world-dm";
import { loadWorldInbox, type WorldInboxItem } from "@/app/actions/world";
import { totalUnread, withUnread, type WorldDm } from "@/lib/world/dm";
import { useTypingAll } from "@/lib/presence";
import { ActionBar, ActionsSheet, CoinChip, MapSheet, MissionsSheet, SpotChoice, StatusSheet, type HudPanel } from "./world-hud";
import { loadWorldGameState } from "@/app/actions/world";
import { STATUSES, type StatusKey } from "@/lib/world/engine/presence";
import type { Spot } from "@/lib/world/engine/scene";
import type { WorldGame } from "@/lib/world/missions-server";

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
  const [picked, setPicked] = useState<PickedMember | null>(null);
  const [text, setText] = useState("");
  const lastSaid = useRef(0);
  const canvasApi = useRef<WorldCanvasApi | null>(null);
  // The game: which panel is open, missions and coins, your status, notes and walking along.
  const [hud, setHud] = useState<HudPanel | null>(null);
  const [game, setGame] = useState<WorldGame | null>(null);
  const [status, setStatusState] = useState<StatusKey | null>(null);
  const autoStatus = useRef(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [following, setFollowing] = useState<string | null>(null);
  const [choice, setChoice] = useState<Spot | null>(null);
  const trained = game?.trainedToday ?? false;
  // Private messages: unread per sender, the post box and an open conversation.
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [inbox, setInbox] = useState<WorldInboxItem[] | null>(null);
  const [post, setPost] = useState<{ kind: "box" } | { kind: "thread"; peer: { id: string; name: string } } | null>(null);
  const [incoming, setIncoming] = useState<WorldDm[]>([]);
  const openWith = post?.kind === "thread" ? post.peer.id : null;
  const typingAll = useTypingAll();
  const typingToMe = [...typingAll.keys()].filter((k) => k.startsWith("dm:")).map((k) => k.slice(3));
  const typingKey = typingToMe.join(",");
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

  // Your status is remembered on this device.
  useEffect(() => {
    let saved: StatusKey | null = null;
    try {
      const v = localStorage.getItem(`wereld-status:${me.id}`);
      if (v && Object.hasOwn(STATUSES, v)) saved = v as StatusKey;
    } catch {}
    const frame = requestAnimationFrame(() => setStatusState(saved));
    return () => cancelAnimationFrame(frame);
  }, [me.id]);
  const setStatus = (next: StatusKey | null, auto = false) => {
    autoStatus.current = auto;
    setStatusState(next);
    try {
      if (next && !auto) localStorage.setItem(`wereld-status:${me.id}`, next);
      else if (!next) localStorage.removeItem(`wereld-status:${me.id}`);
    } catch {}
  };
  useEffect(() => {
    canvasApi.current?.setMine({ status, trained });
  }, [status, trained]);

  // Missions and coins, worked out on the server from what you did in BADI.
  const refreshGame = () =>
    void loadWorldGameState().then((r) => {
      if (r.ok && r.data) setGame(r.data);
    });
  useEffect(() => {
    if (!edit) refreshGame();
  }, [edit]);

  const say2 = (text: string) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  // Into another scene: in the gym your status is "aan het trainen" unless you picked one yourself.
  const enterScene = (to: string, arrive: string | null) => {
    setDim(true);
    setPicked(null);
    setHud(null);
    setChoice(null);
    setFollowing(null);
    if (to === "sportschool" && !status) setStatus("trainen", true);
    else if (to !== "sportschool" && autoStatus.current) setStatus(null);
    setTimeout(() => setHere((h) => ({ scene: to, arrive, n: h.n + 1 })), FADE_MS);
  };
  const openHud = (p: HudPanel | null) => {
    setPicked(null);
    setPost(null);
    setChoice(null);
    setHud(p);
    if (p === "missies") refreshGame();
  };

  // The post box, with unread counts per member.
  const refreshInbox = () =>
    void loadWorldInbox().then((r) => {
      if (!r.ok || !r.data) return;
      setInbox(r.data);
      setUnread(Object.fromEntries(r.data.filter((i) => i.unread > 0).map((i) => [i.userId, i.unread])));
    });
  useEffect(() => {
    if (!edit) refreshInbox();
  }, [edit]);

  // A private message you sent or received, live.
  const onDm = (dm: WorldDm) => {
    canvasApi.current?.showPrivate(dm);
    setUnread((u) => withUnread(u, dm, me.id, openWith));
    const peer = dm.from === me.id ? dm.to : dm.from;
    if (peer === openWith) setIncoming((list) => (list.some((m) => m.id === dm.id) ? list : [...list, dm]));
    if (post?.kind === "box") refreshInbox();
  };
  useLiveDms(me.id, challengeId, !edit, onDm);

  // The canvas shows envelopes and typing dots; it gets them again after every door.
  useEffect(() => {
    canvasApi.current?.setUnread(unread);
  }, [unread]);
  useEffect(() => {
    canvasApi.current?.setTyping(typingKey ? typingKey.split(",") : []);
  }, [typingKey]);
  const syncCanvas = () => {
    canvasApi.current?.setUnread(unread);
    canvasApi.current?.setTyping(typingToMe);
  };

  const openThread = (peer: { id: string; name: string }) => {
    setPicked(null);
    setHud(null);
    setIncoming([]);
    setUnread((u) => ({ ...u, [peer.id]: 0 }));
    setPost({ kind: "thread", peer });
  };
  const openBox = () => {
    setPicked(null);
    setHud(null);
    setPost({ kind: "box" });
    refreshInbox();
  };

  const onDoor = (door: Door) => {
    const to = door.to;
    if (!to || !SCENES[to]) return;
    enterScene(to, door.arrive ?? null);
  };

  const scene = SCENES[here.scene];
  const first = here.n === 0;
  // Where the bottom bar sits, and the panels just above it.
  const bottom = visible?.keyboard ? 8 : "calc(var(--sab) + 12px)";
  const above = "calc(var(--sab) + 128px)";

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
            onReady={() => {
              setDim(false);
              syncCanvas();
            }}
            onPick={(who) => {
              if (who?.self) return openBox();
              setHud(null);
              setPicked(who);
            }}
            apiRef={canvasApi}
            mine={{ status, trained }}
            onSpot={(spot) => {
              setHud(null);
              setPicked(null);
              setChoice(spot);
            }}
            onNotice={say2}
            onFollow={setFollowing}
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
            onClick={() => (post ? setPost(null) : openBox())}
            aria-label={totalUnread(unread) ? `Postvak, ${totalUnread(unread)} ongelezen` : "Postvak"}
            className="pointer-events-auto relative ml-auto grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/90 text-ink shadow-md ring-1 ring-ink/[0.06] backdrop-blur"
          >
            <Mail className="h-[18px] w-[18px]" aria-hidden />
            {totalUnread(unread) ? (
              <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#c9573a] px-1 text-[11px] font-bold text-white">{totalUnread(unread) > 9 ? "9+" : totalUnread(unread)}</span>
            ) : null}
          </button>
        ) : null}
        {!edit ? <CoinChip coins={game?.coins ?? null} onClick={() => openHud(hud === "missies" ? null : "missies")} /> : null}
      </div>

      {toast ? (
        <p className="absolute inset-x-4 mx-auto max-w-sm rounded-full bg-text/90 px-4 py-2 text-center text-[13px] text-paper" style={{ top: "calc(var(--sat) + 68px)" }} role="status">
          {toast}
        </p>
      ) : null}

      {!edit && post?.kind === "box" ? (
        <WorldPostBox
          items={inbox}
          unread={unread}
          where={new Map(peers.map(([id, p]) => [id, SCENES[p.scene]?.name ?? "In de wereld"]))}
          bottom={visible?.keyboard ? 8 : "calc(var(--sab) + 12px)"}
          onOpen={openThread}
          onClose={() => setPost(null)}
        />
      ) : null}
      {!edit && post?.kind === "thread" ? (
        <WorldThread
          key={post.peer.id}
          me={me.id}
          peer={post.peer}
          incoming={incoming}
          bottom={visible?.keyboard ? 8 : "calc(var(--sab) + 12px)"}
          onSent={(dm) => canvasApi.current?.showPrivate(dm)}
          onBack={openBox}
          onClose={() => setPost(null)}
          onFocusInput={() => canvasApi.current?.focusMe()}
        />
      ) : null}

      {!edit && !post && hud === "acties" ? (
        <ActionsSheet
          bottom={above}
          onAct={(kind) => {
            canvasApi.current?.act(kind);
            setHud(null);
          }}
          onClose={() => setHud(null)}
        />
      ) : null}
      {!edit && !post && hud === "status" ? (
        <StatusSheet
          bottom={above}
          status={status}
          onPick={(s) => {
            setStatus(s);
            setHud(null);
          }}
          onClose={() => setHud(null)}
        />
      ) : null}
      {!edit && !post && hud === "kaart" ? (
        <MapSheet
          bottom={above}
          here={here.scene}
          people={peers.map(([id, p]) => ({ id, name: p.name, scene: p.scene, status: p.status ?? null }))}
          onGo={(to) => enterScene(to, null)}
          onClose={() => setHud(null)}
        />
      ) : null}
      {!edit && !post && hud === "missies" ? <MissionsSheet bottom={above} game={game} onClose={() => setHud(null)} /> : null}
      {!edit && !post && choice ? (
        <SpotChoice
          spot={choice}
          bottom={above}
          onDo={() => {
            canvasApi.current?.doSpot(choice.id);
            setChoice(null);
          }}
          onClose={() => setChoice(null)}
        />
      ) : null}

      {!edit && !post ? (
        <div className="absolute inset-x-3 mx-auto max-w-md space-y-2" style={{ bottom }}>
          {picked && !hud ? (
            <div className="space-y-2.5 rounded-[18px] bg-white/95 px-4 py-3 shadow-lg ring-1 ring-ink/[0.06] backdrop-blur" role="status">
              <div className="flex items-center gap-3">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${picked.online ? "bg-[#3f8f4f]" : "bg-ink/20"}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-text">{picked.name}</p>
                  <p className="truncate text-[12.5px] text-muted">
                    {picked.online ? (picked.status ? `${STATUSES[picked.status].icon} ${STATUSES[picked.status].label}` : "Online") : picked.lastSeen ? `Offline · ${relativeTimeNl(picked.lastSeen)}` : "Offline"}
                    {picked.online && picked.trained ? " · heeft vandaag getraind" : ""}
                  </p>
                </div>
                <button type="button" onClick={() => setPicked(null)} aria-label="Sluiten" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted">
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <div className={`grid gap-1.5 ${picked.online ? "grid-cols-4" : "grid-cols-1"}`}>
                {picked.online ? (
                  <>
                    <button type="button" onClick={() => (canvasApi.current?.interact(picked.id, "zwaai"), setPicked(null))} className="flex h-14 flex-col items-center justify-center gap-0.5 rounded-[14px] bg-[#f6ece4] text-[11.5px] font-semibold text-text">
                      <Hand className="h-4 w-4" aria-hidden /> Zwaaien
                    </button>
                    <button type="button" onClick={() => (canvasApi.current?.interact(picked.id, "highfive"), setPicked(null))} className="flex h-14 flex-col items-center justify-center gap-0.5 rounded-[14px] bg-[#f6ece4] text-[11.5px] font-semibold text-text">
                      <span className="text-[15px] leading-none" aria-hidden>
                        🙌
                      </span>
                      High five
                    </button>
                    <button type="button" onClick={() => (canvasApi.current?.interact(picked.id, "meelopen"), setPicked(null))} className="flex h-14 flex-col items-center justify-center gap-0.5 rounded-[14px] bg-[#f6ece4] text-[11.5px] font-semibold text-text">
                      <Footprints className="h-4 w-4" aria-hidden /> Meelopen
                    </button>
                  </>
                ) : null}
                <button type="button" onClick={() => openThread({ id: picked.id, name: picked.name })} className="flex h-14 flex-col items-center justify-center gap-0.5 rounded-[14px] bg-[#2b1d18] text-[11.5px] font-semibold text-white">
                  <Lock className="h-4 w-4" aria-hidden /> Privé
                </button>
              </div>
            </div>
          ) : null}
          {following ? (
            <div className="flex items-center gap-2 rounded-full bg-white/95 py-1.5 pl-4 pr-1.5 text-[13px] text-text shadow-md ring-1 ring-ink/[0.06]">
              <Footprints className="h-4 w-4 text-muted" aria-hidden />
              Je loopt mee met {following}
              <button type="button" onClick={() => canvasApi.current?.stopFollowing()} className="ml-auto rounded-full bg-[#f6ece4] px-3 py-1 text-[12.5px] font-semibold text-ink">
                Stop
              </button>
            </div>
          ) : null}
          {!visible?.keyboard ? <ActionBar open={hud} onOpen={openHud} status={status} /> : null}
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
                setHud(null);
                setPicked(null);
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
