"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Footprints, Hand, Mail, MessageCircle, MessagesSquare, SendHorizontal, X } from "lucide-react";
import { appendLog, readLog, roomLog, saveLog, type LoggedLine } from "@/lib/world/chat-log";
import { ChatLogSheet } from "./world-chat";
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
import { lastPlaceOf, type LastPlace } from "@/lib/world/last-place";
import { readSavedStatus, saveStatus } from "@/lib/world/status-store";
import { TOUR_PARAM, tourSeenKey } from "@/lib/world/tour";
import { WorldTour } from "./world-tour";
import type { Spot } from "@/lib/world/engine/scene";
import type { WorldGame } from "@/lib/world/missions-server";
import { FurnishBar, NotesSheet, ShopSheet, VisitCard } from "./world-room";
import { buyWorldItem, leaveRoomNote, loadRoom, loadRoomNotes, markRoomNotesRead, placeWorldItem, storeWorldItem, type RoomNote, type RoomPiece } from "@/app/actions/world";
import { roomId } from "@/lib/world/scenes/kamers";
import type { ItemDef } from "@/lib/world/items";
import { DoorOpen, Mail as MailIcon, ShoppingBag, Sofa } from "lucide-react";

const FADE_MS = 220;

/**
 * World of Badi, over the whole screen like a game: the scene you are in, a
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
  tour = false,
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
  /** Start the tour (/wereld?rondleiding=1); it also starts by itself the first time. */
  tour?: boolean;
}) {
  const [here, setHere] = useState(() => ({ scene: SCENES[startScene] ? startScene : FIRST_SCENE, arrive: null as string | null, n: 0 }));
  const [dim, setDim] = useState(false);
  const [link, setLink] = useState<WorldLink | null>(null);
  const [peers, setPeers] = useState<[string, WorldPresence][]>([]);
  const [lastKnown, setLastKnown] = useState<Map<string, LastPlace & { updatedAt: string }>>(new Map());
  // The others where they were last: saved, or seen live during this visit (newer).
  const placed = useMemo(() => members.map((m) => ({ ...m, ...(lastKnown.get(m.id) ?? {}) })), [members, lastKnown]);
  const [picked, setPicked] = useState<PickedMember | null>(null);
  const [text, setText] = useState("");
  // What was said in the rooms during this visit, to read back.
  // Only shown once you open it, so reading it from the device right away does not change the first render.
  const [chatLog, setChatLog] = useState<LoggedLine[]>(() => (typeof window === "undefined" ? [] : readLog(me.id)));
  const namesRef = useRef(new Map<string, string>());
  useEffect(() => {
    namesRef.current = new Map([...members.map((m) => [m.id, m.name] as const), [me.id, me.name]]);
  }, [members, me.id, me.name]);
  // The conversation strip on the canvas starts just under the top bar.
  const topBar = useRef<HTMLDivElement>(null);
  const chatTop = useRef(70);
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
  // Own rooms: what stands in the room you are in, your storage, furnishing, the shop and notes.
  const [room, setRoom] = useState<{ scene: string; pieces: RoomPiece[]; storage: { id: string; itemId: string }[] | null; coins: number | null } | null>(null);
  const [furnishing, setFurnishing] = useState(false);
  const [selectedPiece, setSelectedPiece] = useState<string | null>(null);
  const [roomPanel, setRoomPanel] = useState<"winkel" | "briefjes" | "bezoek" | null>(null);
  const [buying, setBuying] = useState<string | null>(null);
  const [notes, setNotes] = useState<RoomNote[]>([]);
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
      if (e.type === "speech") {
        const name = l.peers().get(e.from)?.name ?? namesRef.current.get(e.from) ?? "Iemand";
        setChatLog((was) => {
          const next = appendLog(was, { from: e.from, name, scene: e.scene, text: e.text, at: Date.now() });
          saveLog(me.id, next);
          return next;
        });
      }
      if (e.type === "peers") {
        const now = [...l.peers()];
        setPeers(now);
        // Remember where everyone is, so whoever leaves stays there (offline), also in other rooms.
        setLastKnown((was) => {
          const next = new Map(was);
          const at = new Date().toISOString();
          for (const [id, p] of now) {
            const place = lastPlaceOf(p);
            if (place) next.set(id, { ...place, updatedAt: at });
          }
          return next;
        });
      }
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

  // Measure where the top bar ends, for the conversation strip under it.
  useEffect(() => {
    const el = topBar.current;
    if (!el) return;
    const measure = () => {
      chatTop.current = el.offsetTop + el.offsetHeight + 10;
      canvasApi.current?.setChatTop(chatTop.current);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The tour: asked for in the link, or the first time on this device.
  const [touring, setTouring] = useState(false);
  useEffect(() => {
    if (edit) return;
    let seen = false;
    try {
      seen = localStorage.getItem(tourSeenKey(me.id)) !== null;
    } catch {}
    if (!tour && seen) return;
    const frame = requestAnimationFrame(() => setTouring(true));
    return () => cancelAnimationFrame(frame);
  }, [edit, tour, me.id]);
  const endTour = () => {
    setTouring(false);
    try {
      localStorage.setItem(tourSeenKey(me.id), new Date().toISOString());
    } catch {}
    // A reload should not start it again.
    const url = new URL(window.location.href);
    if (url.searchParams.has(TOUR_PARAM)) {
      url.searchParams.delete(TOUR_PARAM);
      window.history.replaceState(null, "", url.pathname + url.search);
    }
  };

  // Your status is remembered on this device.
  useEffect(() => {
    const saved = readSavedStatus(me.id);
    const frame = requestAnimationFrame(() => setStatusState(saved));
    return () => cancelAnimationFrame(frame);
  }, [me.id]);
  const setStatus = (next: StatusKey | null, auto = false) => {
    autoStatus.current = auto;
    setStatusState(next);
    if (next && !auto) saveStatus(me.id, next);
    else if (!next) saveStatus(me.id, null);
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
    setFurnishing(false);
    setSelectedPiece(null);
    setRoomPanel(null);
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

  // The room you are in: whose it is, and its furniture.
  const sceneNow = SCENES[here.scene];
  const ownerId = sceneNow?.owner ? (sceneNow.owner === me.character ? me.id : (members.find((m) => m.character === sceneNow.owner)?.id ?? null)) : null;
  const ownerName = sceneNow?.owner ? (sceneNow.owner === me.character ? me.name : (members.find((m) => m.character === sceneNow.owner)?.name ?? "")) : "";
  const isMine = Boolean(ownerId && ownerId === me.id);
  useEffect(() => {
    if (!ownerId || edit) return;
    let alive = true;
    void loadRoom(ownerId).then((r) => {
      if (!alive) return;
      if (r.ok && r.data) setRoom({ scene: here.scene, ...r.data });
      else say2(r.ok ? "Laden is niet gelukt." : r.error);
    });
    if (ownerId === me.id)
      void loadRoomNotes().then((r) => {
        if (!alive || !r.ok || !r.data) return;
        setNotes(r.data);
        // Something new left in your room: show it when you come in.
        if (r.data.some((n) => !n.read)) {
          setRoomPanel("briefjes");
          void markRoomNotesRead();
        }
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per room you enter
  }, [ownerId, here.n, edit]);
  const pieces = room && room.scene === here.scene ? room.pieces : [];
  const piecesKey = JSON.stringify(pieces);
  useEffect(() => {
    canvasApi.current?.setPieces(JSON.parse(piecesKey) as RoomPiece[]);
  }, [piecesKey]);
  useEffect(() => {
    canvasApi.current?.setFurnishing(furnishing);
  }, [furnishing]);

  const savePiece = (p: RoomPiece) =>
    void placeWorldItem(p).then((r) => {
      if (!r.ok) say2(r.error);
    });
  const updatePieces = (fn: (list: RoomPiece[]) => RoomPiece[], storage?: (list: { id: string; itemId: string }[]) => { id: string; itemId: string }[]) =>
    setRoom((r) => (r ? { ...r, pieces: fn(r.pieces), storage: r.storage && storage ? storage(r.storage) : r.storage } : r));
  const placeFromStorage = (s: { id: string; itemId: string }) => {
    const spot = canvasApi.current?.spotFor({ ...s, flip: false });
    if (!spot) return say2("Er is in je kamer geen plek meer vrij.");
    const piece: RoomPiece = { ...s, ...spot, flip: false };
    updatePieces((l) => [...l, piece], (st) => st.filter((x) => x.id !== s.id));
    setSelectedPiece(piece.id);
    setTimeout(() => canvasApi.current?.selectPiece(piece.id), 0);
    savePiece(piece);
  };
  const flipSelected = () => {
    const p = pieces.find((x) => x.id === selectedPiece);
    if (!p) return;
    const next = { ...p, flip: !p.flip };
    if (!canvasApi.current?.canPlace(next)) return say2("Gedraaid past het hier niet. Sleep het eerst naar een ruimere plek.");
    updatePieces((l) => l.map((x) => (x.id === p.id ? next : x)));
    savePiece(next);
  };
  const storeSelected = () => {
    const p = pieces.find((x) => x.id === selectedPiece);
    if (!p) return;
    updatePieces((l) => l.filter((x) => x.id !== p.id), (st) => [...st, { id: p.id, itemId: p.itemId }]);
    setSelectedPiece(null);
    void storeWorldItem(p.id).then((r) => {
      if (!r.ok) say2(r.error);
    });
  };
  const buy = async (item: ItemDef) => {
    setBuying(item.id);
    const r = await buyWorldItem(item.id);
    setBuying(null);
    if (!r.ok || !r.data) return say2(r.ok ? "Kopen is niet gelukt." : r.error);
    const bought = { id: r.data.id, itemId: item.id };
    setRoom((x) => (x ? { ...x, coins: r.data!.coins ?? x.coins, storage: x.storage ? [...x.storage, bought] : x.storage } : x));
    refreshGame();
    say2(`${item.name} gekocht.`);
    // In your own room it goes straight in, somewhere free.
    if (isMine) {
      setRoomPanel(null);
      setFurnishing(true);
      setTimeout(() => placeFromStorage(bought), 0);
    }
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
  // In a room there is an extra row of room buttons above the action bar.
  const above = SCENES[here.scene]?.owner ? "calc(var(--sab) + 178px)" : "calc(var(--sab) + 128px)";

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
            members={placed}
            debug={debug}
            overlay={overlay}
            edit={edit}
            onDoor={onDoor}
            onReady={() => {
              setDim(false);
              syncCanvas();
              canvasApi.current?.setChatTop(chatTop.current);
              canvasApi.current?.setPieces(pieces);
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
            onPieceMoved={(p) => {
              updatePieces((l) => l.map((x) => (x.id === p.id ? p : x)));
              savePiece(p);
            }}
            onPieceSelected={setSelectedPiece}
          />
        ) : null}
      </div>

      <div ref={topBar} className="pointer-events-none absolute inset-x-0 top-0 flex items-start gap-2 px-3" style={{ paddingTop: "calc(var(--sat) + 12px)" }}>
        <Link
          href="/"
          aria-label="Terug naar de app"
          className="pointer-events-auto grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/90 text-ink shadow-md ring-1 ring-ink/[0.06] backdrop-blur"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </Link>
        <div className="min-w-0 rounded-full bg-white/90 px-4 py-2 shadow-md ring-1 ring-ink/[0.06] backdrop-blur">
          <p className="truncate text-[10px] font-semibold uppercase leading-tight tracking-[0.14em] text-muted">World of Badi</p>
          <p className="truncate text-[14px] font-semibold leading-tight text-text">{scene.name}</p>
          {edit || notice ? <p className="truncate text-[11.5px] leading-tight text-muted">{edit ? "Zitplekken plaatsen" : notice}</p> : null}
        </div>
        {!edit ? (
          <button
            type="button"
            data-tour="postvak"
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
          myRoom={me.character ? roomId(me.character) : null}
        />
      ) : null}
      {!edit && !post && hud === "gesprek" ? <ChatLogSheet lines={roomLog(chatLog, here.scene)} me={me.id} room={scene.name} bottom={above} onClose={() => setHud(null)} /> : null}
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

      {!edit && !post && furnishing && isMine && roomPanel !== "winkel" ? (
        <FurnishBar
          bottom={bottom}
          storage={room?.storage ?? []}
          selected={pieces.find((p) => p.id === selectedPiece)?.itemId ?? null}
          onPlace={placeFromStorage}
          onFlip={flipSelected}
          onStore={storeSelected}
          onShop={() => setRoomPanel("winkel")}
          onDone={() => {
            setFurnishing(false);
            setSelectedPiece(null);
          }}
        />
      ) : null}
      {!edit && !post && roomPanel === "winkel" ? <ShopSheet bottom={furnishing ? bottom : above} coins={room?.coins ?? game?.coins ?? null} busy={buying} onBuy={(i) => void buy(i)} onClose={() => setRoomPanel(null)} /> : null}
      {!edit && !post && roomPanel === "briefjes" && isMine ? <NotesSheet bottom={above} notes={notes} nameOf={(id) => members.find((m) => m.id === id)?.name ?? "Iemand"} onClose={() => setRoomPanel(null)} /> : null}
      {!edit && !post && roomPanel === "bezoek" && ownerId && !isMine ? (
        <VisitCard
          bottom={above}
          owner={ownerName}
          onLeave={async (kind, body) => {
            const r = await leaveRoomNote({ ownerId, kind, body });
            if (!r.ok) say2(r.error);
            return r.ok;
          }}
          onClose={() => setRoomPanel(null)}
        />
      ) : null}

      {!edit && !post && !furnishing ? (
        <div className="absolute inset-x-3 mx-auto max-w-md space-y-2" style={{ bottom }}>
          {picked && !hud ? (
            <div className="space-y-2.5 rounded-[18px] bg-white/95 px-4 py-3 shadow-lg ring-1 ring-ink/[0.06] backdrop-blur" role="status">
              <div className="flex items-center gap-3">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${picked.online ? "bg-[#3f8f4f]" : "bg-ink/20"}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-text">{picked.name}</p>
                  <p className="truncate text-[12.5px] text-muted">
                    {picked.online ? (picked.status ? `${STATUSES[picked.status].icon} ${STATUSES[picked.status].label}` : "Online") : picked.lastSeen ? `Offline · ${relativeTimeNl(picked.lastSeen)}` : "Nog niet in de wereld geweest"}
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
                <button type="button" onClick={() => openThread({ id: picked.id, name: picked.name })} className="flex h-14 flex-col items-center justify-center gap-0.5 rounded-[14px] bg-[#f6ece4] text-[11.5px] font-semibold text-text">
                  <MessageCircle className="h-4 w-4" aria-hidden /> Bericht
                </button>
                {members.find((m) => m.id === picked.id)?.character ? (
                  <button
                    type="button"
                    onClick={() => enterScene(roomId(members.find((m) => m.id === picked.id)!.character), null)}
                    className={`flex h-14 flex-col items-center justify-center gap-0.5 rounded-[14px] bg-[#f6ece4] text-[11.5px] font-semibold text-text ${picked.online ? "col-span-4" : ""}`}
                  >
                    <DoorOpen className="h-4 w-4" aria-hidden /> Op bezoek in de kamer van {picked.name}
                  </button>
                ) : null}
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
          {ownerId && !visible?.keyboard && !picked ? (
            <div className="flex gap-2">
              {isMine ? (
                <>
                  <button type="button" onClick={() => (setHud(null), setRoomPanel(null), setFurnishing(true))} className="flex h-10 items-center gap-1.5 rounded-full bg-white/95 px-3.5 text-[13px] font-semibold text-ink shadow-md ring-1 ring-ink/[0.06]">
                    <Sofa className="h-4 w-4" aria-hidden /> Inrichten
                  </button>
                  <button type="button" onClick={() => (setHud(null), setRoomPanel(roomPanel === "winkel" ? null : "winkel"))} className="flex h-10 items-center gap-1.5 rounded-full bg-white/95 px-3.5 text-[13px] font-semibold text-ink shadow-md ring-1 ring-ink/[0.06]">
                    <ShoppingBag className="h-4 w-4" aria-hidden /> Winkel
                  </button>
                  <button type="button" onClick={() => (setHud(null), setRoomPanel(roomPanel === "briefjes" ? null : "briefjes"))} aria-label="Achtergelaten in je kamer" className="grid h-10 w-10 place-items-center rounded-full bg-white/95 text-ink shadow-md ring-1 ring-ink/[0.06]">
                    <MailIcon className="h-4 w-4" aria-hidden />
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => (setHud(null), setRoomPanel(roomPanel === "bezoek" ? null : "bezoek"))} className="flex h-10 items-center gap-1.5 rounded-full bg-white/95 px-3.5 text-[13px] font-semibold text-ink shadow-md ring-1 ring-ink/[0.06]">
                  <MailIcon className="h-4 w-4" aria-hidden /> Iets achterlaten voor {ownerName}
                </button>
              )}
            </div>
          ) : null}
          {!visible?.keyboard ? <ActionBar open={hud} onOpen={openHud} status={status} /> : null}
          <form
            data-tour="zeg"
            className="flex items-center gap-2 rounded-full bg-white/95 p-1.5 shadow-lg ring-1 ring-ink/[0.06] backdrop-blur"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <button
              type="button"
              data-tour="gesprek"
              onClick={() => openHud(hud === "gesprek" ? null : "gesprek")}
              aria-label={`Gesprek in ${scene.name} terugkijken`}
              aria-expanded={hud === "gesprek"}
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#f6ece4] text-ink ${hud === "gesprek" ? "ring-2 ring-[#2b1d18]" : ""}`}
            >
              <MessagesSquare className="h-4.5 w-4.5" aria-hidden />
            </button>
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

      {touring ? <WorldTour onDone={endTour} /> : null}
    </div>
  );
}
