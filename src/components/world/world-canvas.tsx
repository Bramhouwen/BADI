"use client";

import { useEffect, useRef, useState } from "react";
import { saveWorldPosition } from "@/app/actions/world";
import { endAction, newAvatar, playAction, step, walkSpeedFor, type Avatar } from "@/lib/world/engine/avatar";
import { dist, pointInPolygon, type Pt } from "@/lib/world/engine/geometry";
import { buildGrid, type Grid } from "@/lib/world/engine/grid";
import { ease, followTarget, heading, startZoom, toggledZoom, zoomLevels } from "@/lib/world/engine/camera";
import { attachInput } from "@/lib/world/engine/input";
import { fastForward, placeAtEnd, startIntent, type Abilities, type Intent } from "@/lib/world/engine/moves";
import { ACTIONS, STATUSES, secondsSince, speechSeconds, type StatusKey, type WorldPresence } from "@/lib/world/engine/presence";
import { avatarAt, clampCamera, drawSeatMarker, render, screenToScene, type Camera, type View } from "@/lib/world/engine/renderer";
import { seatAt } from "@/lib/world/engine/seats";
import { loadCharacter, type LoadedCharacter } from "@/lib/world/engine/sprites";
import type { Door, SceneDef, Seat, Spot } from "@/lib/world/engine/scene";
import type { WorldLink } from "./world-link";
import { lockBalloonOver, totalUnread, type WorldDm } from "@/lib/world/dm";
import { basePoint, depthOf, fits, footprintPolygon, freeSpot, seatHip, type Placement } from "@/lib/world/engine/furniture";
import { ITEM_BY_ID, RACK, RACK_AT, itemImage } from "@/lib/world/items";
import type { Prop } from "@/lib/world/engine/renderer";
import type { RoomPiece } from "@/app/actions/world";
import { liveLines, pushLine, type ChatLine } from "@/lib/world/engine/chat-strip";
import { PETS, newPet, petFrame, stepPet, type Pet, type PetPose } from "@/lib/world/engine/pet";
import { findPath, smoothPath } from "@/lib/world/engine/pathfinding";
import { landingRotation, type Segment } from "@/lib/wheel";
import { WHEEL_SCENE, WHEEL_SPIN_MS, isSquare, wheelEase } from "@/lib/world/wheel-ring";
import { WHEEL_FACE } from "@/lib/world/scenes/huis";

const PAGE = "#f6ece4";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(src));
    img.src = src;
  });
}

/** Centre of the walkable tile nearest to a point: where you walk to before sitting down. */
function approachFor(grid: Grid, p: Pt): Pt | null {
  const t = grid.nearestWalkable([p[0], p[1] + 60]);
  return t ? grid.tileToPx(t[0] + 0.5, t[1] + 0.5) : null;
}

const round = (p: Pt): Pt => [Math.round(p[0]), Math.round(p[1])];

interface EditorActions {
  tryOut(id: string): void;
}

/** Someone else in the world, as the page knows them: where they were last when not online. */
export interface WorldMember {
  id: string;
  name: string;
  character: string;
  scene: string;
  x: number | null;
  y: number | null;
  /** Seat or spot they were on. */
  activity: string | null;
  updatedAt: string;
  /** The frames to draw them with while offline, when that is an outfit (public/wereld/poppetjes/<look>); else `character`. */
  look?: string;
}

/** What the screen around the world can ask of the canvas. */
export interface WorldCanvasApi {
  /** Look at your own character from close by, for example while you type. */
  focusMe(): void;
  /** A private message between you and someone in this room: a balloon with a lock over the sender. */
  showPrivate(dm: WorldDm): void;
  /** Unread private messages per sender: envelopes over them and the total over you. */
  setUnread(unread: Readonly<Record<string, number>>): void;
  /** Who is typing a private message to you. */
  setTyping(ids: readonly string[]): void;
  /** Do something for the room to see. */
  act(kind: "zwaai" | "juich" | "dans"): void;
  /** Towards someone: wave at them, walk over for a high five, or walk along with them. */
  interact(id: string, kind: "zwaai" | "highfive" | "meelopen"): void;
  stopFollowing(): void;
  /** Your status and whether you trained today, shared with the others. */
  setMine(mine: { status: StatusKey | null; trained: boolean }): void;
  /** Go and do what a spot is for, after choosing it (run on the treadmill). */
  doSpot(id: string): void;
  /** The furniture in this room. */
  setPieces(pieces: RoomPiece[]): void;
  /** Furnishing your own room: drag pieces over the floor. */
  setFurnishing(on: boolean): void;
  /** Where a new piece from storage fits, or null when the room is full. */
  spotFor(piece: Omit<RoomPiece, "u" | "v">): { u: number; v: number } | null;
  /** Whether a piece fits at its place (after turning it). */
  canPlace(piece: RoomPiece): boolean;
  /** Highlight a piece while furnishing. */
  selectPiece(id: string | null): void;
  /** Where the conversation strip starts: just under the top bar (CSS pixels). */
  setChatTop(px: number): void;
  /** Change clothes: draw your character with these frames (public/wereld/poppetjes/<key>) and tell the others. */
  setLook(key: string): void;
  /** The app's Weekrad face and pointer (same box, wheel turns, pointer not), drawn over the wheel in the back garden. */
  setWheel(wheel: { face: CanvasImageSource; pointer: CanvasImageSource; segments: readonly Segment[] }): void;
}

/** Who you tapped. */
export interface PickedMember {
  id: string;
  name: string;
  online: boolean;
  /** When they were last in the world, for someone offline. */
  lastSeen: string | null;
  /** You tapped yourself. */
  self?: boolean;
  status?: StatusKey | null;
  trained?: boolean;
}

/**
 * One scene of World of Badi on a canvas: your character walks where you tap,
 * around furniture and behind it, sits on seats and walks to the door. Drag
 * to look around, pinch or scroll to zoom. `overlay` shows the walking grid.
 *
 * `edit` is the placement mode: tap the seat of a sofa or chair to add a seat
 * (its hip point), drag the pink hip point or the green walking spot, set the
 * facing, try it out with your own character and save it to the scene's JSON.
 */
export function WorldCanvas({
  scene,
  me,
  startX = null,
  startY = null,
  debug = false,
  overlay = false,
  edit = false,
  arriveAt = null,
  restore = null,
  link = null,
  members = [],
  onDoor,
  onReady,
  onPick,
  apiRef,
  mine = { status: null, trained: false },
  onSpot,
  onNotice,
  onFollow,
  onPieceMoved,
  onPieceSelected,
  onRack,
  onArrive,
}: {
  scene: SceneDef;
  /** `look`: the frames you are drawn with when that is an outfit; read when the scene starts, later changes go through setLook. */
  me: { id: string; name: string; character: string | null; look?: string | null };
  startX?: number | null;
  startY?: number | null;
  debug?: boolean;
  overlay?: boolean;
  edit?: boolean;
  /** Door in this scene you come in through. */
  arriveAt?: string | null;
  /** The seat or spot you were on when you left, to sit there again (only with startX/startY). */
  restore?: string | null;
  /** Live link to the others; none in the placement mode. */
  link?: WorldLink | null;
  /** The others with their last place, shown in a rest pose while offline. */
  members?: WorldMember[];
  /** You walked into a door that leads to another scene. */
  onDoor?: (door: Door) => void;
  /** The scene is loaded and drawn. */
  onReady?: () => void;
  /** You tapped someone (or next to them: null). */
  onPick?: (who: PickedMember | null) => void;
  /** Filled with the canvas controls while the scene runs. */
  apiRef?: { current: WorldCanvasApi | null };
  /** Your status and training glow at the start of the scene. */
  mine?: { status: StatusKey | null; trained: boolean };
  /** You tapped a spot that offers a choice (the treadmill: run, or log a training). */
  onSpot?: (spot: Spot) => void;
  /** Something to tell you, like someone waving at you. */
  onNotice?: (text: string) => void;
  /** Who you are walking along with, or null when that stopped. */
  onFollow?: (name: string | null) => void;
  /** Furnishing: a piece was dragged to a new place where it fits. */
  onPieceMoved?: (piece: RoomPiece) => void;
  /** Furnishing: the piece you tapped, or null. */
  onPieceSelected?: (id: string | null) => void;
  /** You walked up to the clothing rack of this room. */
  onRack?: () => void;
  /** You arrived at a spot, or sat down: for the status that goes with it. */
  onArrive?: (at: { spot: Spot } | { seat: string }) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const fpsRef = useRef<HTMLParagraphElement>(null);
  // Latest callbacks, so a new function from the parent does not restart the scene.
  const onDoorRef = useRef(onDoor);
  const onReadyRef = useRef(onReady);
  const onPickRef = useRef(onPick);
  const membersRef = useRef(members);
  const onSpotRef = useRef(onSpot);
  const onNoticeRef = useRef(onNotice);
  const onFollowRef = useRef(onFollow);
  const mineRef = useRef(mine);
  const onPieceMovedRef = useRef(onPieceMoved);
  const onPieceSelectedRef = useRef(onPieceSelected);
  const onRackRef = useRef(onRack);
  const onArriveRef = useRef(onArrive);
  const lookRef = useRef(me.look);
  useEffect(() => {
    onRackRef.current = onRack;
    onArriveRef.current = onArrive;
    lookRef.current = me.look;
    onPieceMovedRef.current = onPieceMoved;
    onPieceSelectedRef.current = onPieceSelected;
    onDoorRef.current = onDoor;
    onReadyRef.current = onReady;
    onPickRef.current = onPick;
    membersRef.current = members;
    onSpotRef.current = onSpot;
    onNoticeRef.current = onNotice;
    onFollowRef.current = onFollow;
    mineRef.current = mine;
  });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [note, setNote] = useState<string | null>(null);
  // Placement mode: the seats being edited, shared between the canvas loop and the panel.
  const [seats, setSeats] = useState<Seat[]>(() => scene.seats.map((s) => ({ ...s })));
  const seatsRef = useRef<Seat[]>(seats);
  const selectedRef = useRef<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<string | null>(null);
  const actionsRef = useRef<EditorActions | null>(null);

  const commit = (next: Seat[], sel: string | null = selectedRef.current) => {
    seatsRef.current = next;
    selectedRef.current = sel;
    setSeats(next);
    setSelected(sel);
    setSaveState(null);
  };

  useEffect(() => {
    const box = boxRef.current;
    const canvas = canvasRef.current;
    if (!box || !canvas || !me.character) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let alive = true;
    let raf = 0;
    let noteTimer: ReturnType<typeof setTimeout> | undefined;
    let saveTimer: ReturnType<typeof setTimeout> | undefined;
    // A position not saved yet: saved right away when you leave, so the others see you where you were.
    let flushSave: (() => void) | null = null;
    let offHide: (() => void) | null = null;
    let detach: (() => void) | null = null;
    let cleanupLink: (() => void) | null = null;
    let ro: ResizeObserver | null = null;
    // The conversation strip at the top: what is said in this room.
    let chatLines: ChatLine[] = [];
    let chatTop = 70;
    let chatId = 0;
    const say = (text: string) => {
      setNote(text);
      clearTimeout(noteTimer);
      noteTimer = setTimeout(() => setNote(null), 3200);
    };
    // The scene as it is being edited: same as `scene`, with the seats from the placement mode.
    // Furniture in a room: placed pieces, their seats, and whether you are furnishing.
    let pieces: Placement[] = [];
    let pieceSeats: Seat[] = [];
    let furnishing = false;
    let selectedPiece: string | null = null;
    let movingOk = true;
    const images = new Map<string, HTMLImageElement>();
    const baseGrid = buildGrid(scene);
    let grid = baseGrid;
    const live = (): SceneDef => (edit ? { ...scene, seats: seatsRef.current } : pieceSeats.length ? { ...scene, seats: [...scene.seats, ...pieceSeats] } : scene);
    const outlines = new Map(
      scene.occluders.map((o) => {
        const p = new Path2D();
        o.outline.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
        p.closePath();
        return [o.id, p] as const;
      }),
    );
    const view: View = { width: 1, height: 1, dpr: 1 };
    let cam: Camera = { x: scene.width / 2, y: scene.height / 2, zoom: 0.5 };
    // The camera follows you (looking ahead while you walk) until you look around yourself; the next tap brings it back.
    let follow = false;
    // A zoom on its way after a double tap, eased per frame.
    let zoomTo: number | null = null;
    let lead: Pt = [0, 0];
    let page = PAGE;
    const zoomLimits = () => zoomLevels(scene, view);
    const resize = () => {
      const r = box.getBoundingClientRect();
      view.width = Math.max(1, r.width);
      view.height = Math.max(1, r.height);
      view.dpr = Math.min(3, window.devicePixelRatio || 1);
      canvas.width = Math.round(view.width * view.dpr);
      canvas.height = Math.round(view.height * view.dpr);
      canvas.style.width = view.width + "px";
      canvas.style.height = view.height + "px";
      const { min, max } = zoomLimits();
      cam = clampCamera({ ...cam, zoom: Math.min(max, Math.max(min, cam.zoom)) }, scene, view);
    };

    (async () => {
      try {
        const [background, character] = await Promise.all([loadImage(scene.background), loadCharacter(lookRef.current ?? me.character!)]);
        if (!alive) return;
        const characters = new Map<string, LoadedCharacter>([[character.key, character]]);
        // Around the picture (zoomed out on a tall screen): the colour of the picture's own edge, so it runs on seamlessly.
        try {
          const probe = document.createElement("canvas");
          probe.width = probe.height = 1;
          const pc = probe.getContext("2d");
          if (pc) {
            pc.drawImage(background, 4, 4, 1, 1, 0, 0, 1, 1);
            const [r, g, b] = pc.getImageData(0, 0, 1, 1).data;
            page = `rgb(${r}, ${g}, ${b})`;
          }
        } catch {}
        const now0 = performance.now();
        const door = arriveAt ? scene.doors.find((d) => d.id === arriveAt) : null;
        const start: Pt | null = door ? door.approach : startX !== null && startY !== null ? [startX, startY] : null;
        const startTile = start ? grid.tileAt(start) : null;
        const feet: Pt = start && startTile && grid.isWalkable(...startTile) ? start : scene.spawn;
        const speed = scene.walkSpeed ?? walkSpeedFor(scene.characterHeight);
        const me0: Avatar = newAvatar(me.id, character.key, me.name, feet, now0);
        me0.speed = speed;
        if (door) me0.facing = door.approach[0] < scene.width / 2 ? "right" : "left";
        const avatars: Avatar[] = [me0];
        const abilities = (c: LoadedCharacter): Abilities => ({
          canSit: Boolean(c.manifest.animations.zitten) && !c.manifest.animations.zitten.withChair,
          has: (pose) => Boolean(c.manifest.animations[pose]),
        });
        let mine = abilities(character);
        const intentOf = (activity: string | null): Intent | null => {
          if (!activity) return null;
          if (scene.seats.some((s) => s.id === activity)) return { kind: "seat", id: activity };
          if (scene.spots.some((s) => s.id === activity)) return { kind: "spot", id: activity };
          return null;
        };
        // Back where you left: on your seat again.
        const restored = !door && start ? intentOf(restore) : null;
        if (restored) placeAtEnd(me0, scene, restored, now0, mine);

        resize();
        cam = clampCamera({ x: me0.feet[0], y: me0.feet[1] - scene.characterHeight * 0.4, zoom: edit ? zoomLimits().overview : startZoom(scene, zoomLimits()) }, scene, view);
        follow = !edit;
        ro = new ResizeObserver(resize);
        ro.observe(box);

        const activityOf = (a: Avatar) => (a.state === "sit" ? a.seat : a.state === "act" ? a.spot : null);
        const remember = () => {
          if (edit) return;
          clearTimeout(saveTimer);
          flushSave = () => {
            flushSave = null;
            clearTimeout(saveTimer);
            void saveWorldPosition({ scene: scene.id, x: me0.feet[0], y: me0.feet[1], activity: activityOf(me0) });
          };
          saveTimer = setTimeout(() => flushSave?.(), 1200);
        };
        // Leaving the app (another app, the screen off): save now, not in a moment.
        const onHide = () => {
          if (document.visibilityState === "hidden") flushSave?.();
        };
        document.addEventListener("visibilitychange", onHide);
        window.addEventListener("pagehide", onHide);
        offHide = () => {
          document.removeEventListener("visibilitychange", onHide);
          window.removeEventListener("pagehide", onHide);
        };
        // Tell the others: only where you start from and what you are going to do, plus your status.
        me0.status = mineRef.current.status;
        me0.trained = mineRef.current.trained;
        let lastMove: { intent: Intent; from: Pt; at: number } | null = null;
        const send = () => {
          if (edit || !link || !lastMove) return;
          link.publish({ v: 1, name: me.name, character: me0.character, scene: scene.id, from: lastMove.from, intent: lastMove.intent, at: lastMove.at, status: (me0.status as StatusKey | null) ?? null, trained: me0.trained });
        };
        const publish = (intent: Intent, from: Pt) => {
          lastMove = { intent, from, at: Date.now() };
          send();
        };
        // Walking along with someone: the id, and where you last set off to.
        let following: string | null = null;
        let followGoal: Pt | null = null;
        const stopFollowing = () => {
          if (!following) return;
          following = null;
          followGoal = null;
          onFollowRef.current?.(null);
        };
        const move = (intent: Intent, then?: () => void) => {
          const from = me0.feet;
          const result = startIntent(me0, live(), grid, intent, performance.now(), mine, () => {
            remember();
            then?.();
          });
          if (result === "unreachable") return say("Daar kun je niet komen.");
          if (result === "cannot") return say(intent.kind === "seat" ? `${me.name} heeft nog geen zitpose zonder stoel.` : `${me.name} heeft hier nog geen animatie voor.`);
          publish(intent, from);
        };
        const tapScene = (p: Pt) => {
          stopFollowing();
          const door = scene.doors.find((d) => pointInPolygon(p, d.tap));
          if (door) {
            move({ kind: "stand", to: door.approach }, () => {
              if (door.to && onDoorRef.current) onDoorRef.current(door);
              else say("Deze deur gaat nog nergens heen.");
            });
            return;
          }
          const spot = scene.spots.find((s) => pointInPolygon(p, s.tap));
          // A spot with a choice (the treadmill) asks first; the Weekrad asks once you are there.
          if (spot?.link && !spot.walkFirst && onSpotRef.current) return onSpotRef.current(spot);
          // A square in front of the Weekrad holds one person.
          if (spot && isSquare(spot.id)) {
            const there = [...others.values()].find((o) => o.live && o.av.spot === spot.id && o.av.state === "act");
            if (there) return say(`Hier staat ${there.av.name} al.`);
          }
          if (spot)
            return move({ kind: "spot", id: spot.id }, () => {
              onArriveRef.current?.({ spot });
              if (spot.walkFirst && spot.link) onSpotRef.current?.(spot);
            });
          const seat = seatAt(live(), p);
          if (seat) return move({ kind: "seat", id: seat.id }, () => onArriveRef.current?.({ seat: seat.id }));
          move({ kind: "stand", to: p });
        };
        actionsRef.current = {
          tryOut(id) {
            move({ kind: "seat", id });
          },
        };

        // The others: live from the link, or where they were last (offline, in a rest pose).
        interface Other {
          av: Avatar;
          at: number;
          intent: Intent | null;
          live: boolean;
          lastSeen: string | null;
        }
        const others = new Map<string, Other>();
        const drop = (id: string) => {
          const o = others.get(id);
          if (!o) return;
          others.delete(id);
          const i = avatars.indexOf(o.av);
          if (i >= 0) avatars.splice(i, 1);
        };
        const ensure = (id: string, name: string, key: string, feetAt: Pt): Other => {
          let o = others.get(id);
          if (!o) {
            const av = newAvatar(id, key, name, feetAt, performance.now());
            av.speed = speed;
            o = { av, at: -1, intent: null, live: false, lastSeen: null };
            others.set(id, o);
            avatars.push(av);
          }
          o.av.name = name;
          return o;
        };
        const withCharacter = (key: string, then: (c: LoadedCharacter) => void) => {
          const c = characters.get(key);
          if (c) return then(c);
          void loadCharacter(key)
            .then((loadedC) => {
              if (!alive) return;
              characters.set(loadedC.key, loadedC);
              then(loadedC);
            })
            .catch(() => {});
        };
        // Offline: still sitting on a seat; off a treadmill or mat, standing next to it; else standing where they were.
        const restPose = (intent: Intent | null, at: Pt): Intent => {
          if (intent?.kind === "seat") return intent;
          if (intent?.kind === "spot") return { kind: "stand", to: scene.spots.find((s) => s.id === intent.id)?.approach ?? at };
          return { kind: "stand", to: at };
        };
        const showOffline = () => {
          for (const m of membersRef.current) {
            if (m.id === me.id || m.scene !== scene.id || m.x === null || m.y === null || others.get(m.id)?.live) continue;
            const o = ensure(m.id, m.name, m.look ?? m.character, [m.x, m.y]);
            o.av.offline = true;
            o.lastSeen = m.updatedAt;
            withCharacter(m.look ?? m.character, (c) => {
              if (o.live) return;
              placeAtEnd(o.av, scene, restPose(intentOf(m.activity), [m.x!, m.y!]), performance.now(), abilities(c));
            });
          }
        };
        const applyPeer = (id: string, p: WorldPresence) => {
          // Live somewhere else: not here, also not as where they were last.
          if (p.scene !== scene.id) {
            if (others.has(id)) drop(id);
            return;
          }
          const first = !others.get(id)?.live;
          const o = ensure(id, p.name, p.character, p.from);
          o.live = true;
          o.av.offline = false;
          o.lastSeen = null;
          o.av.status = p.status ?? null;
          o.av.trained = Boolean(p.trained);
          // Changed clothes without moving: only the frames change.
          if (o.at === p.at) {
            if (o.av.character !== p.character)
              withCharacter(p.character, (c) => {
                if (o.live) o.av.character = c.key;
              });
            return;
          }
          o.at = p.at;
          o.intent = p.intent;
          withCharacter(p.character, (c) => {
            const can = abilities(c);
            const t = performance.now();
            o.av.character = c.key;
            o.av.feet = p.from;
            if (startIntent(o.av, scene, grid, p.intent, t, can) !== "ok") placeAtEnd(o.av, scene, p.intent, t, can);
            // Already on the way when you came in: show them where they are now.
            else if (first) fastForward(o.av, secondsSince(p.at, Date.now()), t);
          });
        };
        const syncPeers = () => {
          if (!link) return;
          const peers = link.peers();
          for (const [id, p] of peers) applyPeer(id, p);
          // Left the world: they stay where their last move ended, in a rest pose.
          for (const [id, o] of others) {
            if (!o.live || peers.has(id)) continue;
            o.live = false;
            o.av.offline = true;
            o.lastSeen = new Date().toISOString();
            const c = characters.get(o.av.character);
            // Never gone: in a rest pose where they were, offline.
            if (o.intent && c) placeAtEnd(o.av, scene, restPose(o.intent, o.intent.kind === "stand" ? o.intent.to : o.av.feet), performance.now(), abilities(c));
          }
        };
        showOffline();
        let unsubscribe: (() => void) | null = null;
        if (link && !edit) {
          syncPeers();
          unsubscribe = link.subscribe((e) => {
            if (!alive) return;
            if (e.type === "peers") return syncPeers();
            // Someone spun the Weekrad: turn the wheel in the back garden to where it lands.
            if (e.type === "wheel") {
              if (scene.id !== WHEEL_SCENE || !wheel) return;
              wheelAnim = { from: wheelRot, to: landingRotation(wheel.segments, e.category, wheelRot, e.seed, 6), start: performance.now() };
              return;
            }
            if (e.scene !== scene.id) return;
            const avatarOf = (id: string | null) => (!id ? null : id === me.id ? me0 : (others.get(id)?.av ?? null));
            const who = avatarOf(e.from);
            if (e.type === "speech") {
              const t = performance.now();
              if (who) who.speech = { text: e.text, until: t + speechSeconds(e.text) * 1000 };
              const name = who?.name ?? link.peers().get(e.from)?.name ?? "Iemand";
              chatLines = pushLine(liveLines(chatLines, t), { id: ++chatId, from: e.from, name, text: e.text, at: t, x: null, y: null });
              return;
            }
            // An action: played on whoever does it; a high five on both of you.
            const action = ACTIONS[e.kind];
            const target = avatarOf(e.to);
            const t = performance.now();
            const towards = (a: Avatar, b: Avatar | null) => (b ? (b.feet[0] < a.feet[0] ? "left" : "right") : undefined);
            if (who) playAction(who, action.pose, action.seconds, t, towards(who, target));
            if (e.kind === "highfive" && target) playAction(target, action.pose, action.seconds, t, towards(target, who));
            if (e.to === me.id && e.from !== me.id && who) {
              if (e.kind === "zwaai") onNoticeRef.current?.(`${who.name} zwaait naar je`);
              if (e.kind === "highfive") onNoticeRef.current?.(`${who.name} geeft je een high five`);
            }
          });
          publish(restored ?? { kind: "stand", to: me0.feet }, me0.feet);
        }
        cleanupLink = () => unsubscribe?.();
        // Coming in: this is your place now, also before you take a step.
        if (!edit) remember();
        let picked: string | null = null;
        let unread = new Map<string, number>();
        let typing = new Set<string>();
        const statusOf = (a: Avatar) => (a.status && Object.hasOwn(STATUSES, a.status) ? (a.status as StatusKey) : null);
        const pick = (sx: number, sy: number): boolean => {
          const hit = avatarAt(sx, sy, avatars, characters, scene, cam, view);
          // Yourself: only when there is post, to open the post box.
          if (hit === me0) {
            if (!(unread.get(me.id) ?? 0)) return false;
            onPickRef.current?.({ id: me.id, name: me.name, online: true, lastSeen: null, self: true });
            return true;
          }
          picked = hit ? hit.id : null;
          const o = hit ? others.get(hit.id) : null;
          onPickRef.current?.(hit && o ? { id: hit.id, name: hit.name, online: o.live, lastSeen: o.lastSeen, status: o.live ? statusOf(hit) : null, trained: o.live && hit.trained } : null);
          return Boolean(hit);
        };

        // Furniture: the floor it takes, the seats it offers, and its pictures.
        const refreshPieces = () => {
          const solid = pieces.filter((p) => !p.item.flat).map((p) => footprintPolygon(baseGrid, p));
          grid = solid.length ? buildGrid({ ...scene, blockers: [...scene.blockers, ...solid] }) : baseGrid;
          pieceSeats = pieces.flatMap((p) => {
            const hip = seatHip(baseGrid, p);
            if (!hip) return [];
            const [a, b] = p.flip ? [p.item.foot[1], p.item.foot[0]] : p.item.foot;
            const front = baseGrid.tileToPx(p.u + a + 0.5, p.v + b + 0.5);
            const t = grid.nearestWalkable(front);
            if (!t) return [];
            return [{ id: p.id, hip, facing: "right" as const, approach: grid.tileToPx(t[0] + 0.5, t[1] + 0.5), on: null }];
          });
          for (const p of pieces) {
            if (images.has(p.item.id)) continue;
            const img = new Image();
            img.decoding = "async";
            img.src = itemImage(p.item.id);
            images.set(p.item.id, img);
          }
        };
        const toPlacement = (r: RoomPiece): Placement | null => {
          const item = ITEM_BY_ID.get(r.itemId);
          return item ? { id: r.id, item, u: r.u, v: r.v, flip: r.flip } : null;
        };
        const propsNow = (): Prop[] =>
          pieces.flatMap((p) => {
            const img = images.get(p.item.id);
            if (!img || !img.complete || !img.naturalWidth) return [];
            const [x, y] = basePoint(baseGrid, p);
            const selected = furnishing && p.id === selectedPiece;
            return [{ img, x, y, w: p.item.w, h: p.item.h, flip: p.flip, depth: depthOf(baseGrid, p), flat: Boolean(p.item.flat), outline: selected ? { poly: footprintPolygon(baseGrid, p), ok: movingOk } : null, alpha: selected && !movingOk ? 0.7 : undefined }];
          });
        // A pet in this room (Daphne's dog): wanders between the furniture. Every phone runs its own.
        const petDef = scene.owner && !scene.space ? PETS[scene.owner] : undefined;
        const petImages = new Map<string, HTMLImageElement>();
        if (petDef)
          for (const [pose, n] of Object.entries(petDef.frames) as [PetPose, number][])
            for (let i = 1; i <= n; i++) {
              const img = new Image();
              img.decoding = "async";
              img.src = `/wereld/dieren/${petDef.key}/${pose}-${String(i).padStart(2, "0")}.png`;
              petImages.set(`${pose}-${i}`, img);
            }
        const freeTiles = () => {
          const out: [number, number][] = [];
          for (let u = 0; u < grid.nu; u++) for (let v = 0; v < grid.nv; v++) if (grid.isWalkable(u, v)) out.push([u, v]);
          return out;
        };
        let pet: Pet | null = null;
        // The Weekrad in the back garden: the app's face over the painted one, turning when someone spins.
        let wheel: { face: CanvasImageSource; pointer: CanvasImageSource; segments: readonly Segment[] } | null = null;
        let wheelRot = 0;
        let wheelAnim: { from: number; to: number; start: number } | null = null;
        const wheelProp = (now: number): Prop[] => {
          if (!wheel || scene.id !== WHEEL_SCENE) return [];
          if (wheelAnim) {
            const t = (now - wheelAnim.start) / WHEEL_SPIN_MS;
            wheelRot = wheelAnim.from + (wheelAnim.to - wheelAnim.from) * wheelEase(t);
            if (t >= 1) {
              wheelRot = wheelAnim.to;
              wheelAnim = null;
            }
          }
          const size = WHEEL_FACE.r * 2.2;
          return [{ img: wheel.face, overlay: wheel.pointer, x: WHEEL_FACE.x, y: WHEEL_FACE.y + size / 2, w: size, h: size, rotate: wheelRot, flip: false, depth: WHEEL_FACE.depth, flat: false }];
        };
        if (petDef) {
          const tiles = freeTiles();
          const t = tiles[Math.floor(Math.random() * tiles.length)];
          if (t) pet = newPet(grid.tileToPx(t[0] + 0.5, t[1] + 0.5), performance.now());
        }
        // A new place a few tiles away, and the way there around the furniture.
        const petRoute = (): Pt[] | null => {
          if (!pet) return null;
          // Furniture may have been put where it stands: start from the nearest free tile.
          const at = grid.tileAt(pet.feet);
          const from = at && grid.isWalkable(...at) ? at : grid.nearestWalkable(pet.feet);
          const tiles = freeTiles();
          if (!from || !tiles.length) return null;
          for (let tries = 0; tries < 12; tries++) {
            const to = tiles[Math.floor(Math.random() * tiles.length)];
            if (Math.hypot(to[0] - from[0], to[1] - from[1]) < 2) continue;
            const path = findPath(grid, from, to);
            if (path) return smoothPath(grid, path).slice(1).map(([u, v]) => grid.tileToPx(u + 0.5, v + 0.5));
          }
          return null;
        };
        const petProp = (now: number): Prop[] => {
          if (!pet || !petDef) return [];
          const img = petImages.get(`${pet.pose}-${petFrame(petDef, pet, now)}`);
          if (!img?.complete || !img.naturalWidth) return [];
          const k = petDef.height / petDef.frameHeight;
          const w = petDef.frameWidth * k, h = petDef.frameHeight * k;
          return [{ img, x: pet.feet[0], y: pet.feet[1] + (petDef.frameHeight - petDef.feetY) * k, w, h, flip: (pet.facing === "left") === petDef.facesRight, depth: pet.feet[1], flat: false }];
        };
        const seatDepth = () => new Map(pieces.map((p) => [p.id, depthOf(baseGrid, p)]));
        // The piece under a finger: the front-most picture that covers that point.
        // The rack stays where it is: it is left out while furnishing.
        const pieceAt = (sx: number, sy: number, withRack = false): Placement | null => {
          const [x, y] = screenToScene(sx, sy, cam, view);
          let best: Placement | null = null;
          let bestDepth = -Infinity;
          for (const p of pieces) {
            if (p.id === RACK.id && !withRack) continue;
            const [bx, by] = basePoint(baseGrid, p);
            if (x < bx - p.item.w / 2 || x > bx + p.item.w / 2 || y < by - p.item.h || y > by + 8) continue;
            const d = depthOf(baseGrid, p) + (p.item.flat ? -10000 : 0);
            if (d > bestDepth) {
              bestDepth = d;
              best = p;
            }
          }
          return best;
        };
        let movingPiece: { id: string; from: { u: number; v: number }; grab: [number, number] } | null = null;
        const goToRack = (rack: Placement) => {
          stopFollowing();
          const [a, b] = rack.flip ? [rack.item.foot[1], rack.item.foot[0]] : rack.item.foot;
          const t = grid.nearestWalkable(baseGrid.tileToPx(rack.u + a + 0.5, rack.v + b / 2));
          if (!t) return onRackRef.current?.();
          const [bx] = basePoint(baseGrid, rack);
          move({ kind: "stand", to: grid.tileToPx(t[0] + 0.5, t[1] + 0.5) }, () => {
            me0.facing = bx < me0.feet[0] ? "left" : "right";
            onRackRef.current?.();
          });
        };

        if (apiRef)
          apiRef.current = {
            focusMe() {
              follow = true;
              const l = zoomLimits();
              if (cam.zoom < l.close * 0.95) zoomTo = l.close;
            },
            showPrivate(dm) {
              const inRoom = (id: string) => id === me.id || Boolean(others.get(id)?.live);
              const over = lockBalloonOver(dm, me.id, inRoom);
              const who = over === me.id ? me0 : over ? others.get(over)?.av : null;
              if (who) who.speech = { text: dm.text, until: performance.now() + speechSeconds(dm.text) * 1000, private: true };
            },
            setUnread(next) {
              unread = new Map(Object.entries(next).filter(([, n]) => n > 0));
              const total = totalUnread(next);
              if (total) unread.set(me.id, total);
            },
            setTyping(ids) {
              typing = new Set(ids);
            },
            setChatTop(px) {
              chatTop = px;
            },
            setWheel(next) {
              wheel = next;
            },
            setLook(key) {
              withCharacter(key, (c) => {
                me0.character = c.key;
                mine = abilities(c);
                send();
              });
            },
            act(kind) {
              if (!link) return;
              if (me0.state !== "idle") return say("Dat kan als je stilstaat.");
              link.act(scene.id, kind, null);
            },
            interact(id, kind) {
              const o = others.get(id);
              if (!o || !link) return;
              const t = o.av;
              if (kind === "zwaai") {
                if (me0.state !== "idle") return say("Dat kan als je stilstaat.");
                me0.facing = t.feet[0] < me0.feet[0] ? "left" : "right";
                return link.act(scene.id, "zwaai", id);
              }
              if (kind === "meelopen") {
                if (!o.live) return say(`${t.name} is er nu niet.`);
                following = id;
                followGoal = null;
                onFollowRef.current?.(t.name);
                return;
              }
              // High five: walk up to them, then both cheer.
              stopFollowing();
              const side = me0.feet[0] < t.feet[0] ? -1 : 1;
              const gap = scene.characterHeight * 0.42;
              const free = (p: Pt) => {
                const tile = grid.tileAt(p);
                return Boolean(tile && grid.isWalkable(...tile));
              };
              const next: Pt = [t.feet[0] + side * gap, t.feet[1]];
              const dest = free(next) ? next : ([t.feet[0] - side * gap, t.feet[1]] as Pt);
              move({ kind: "stand", to: dest }, () => {
                me0.facing = t.feet[0] < me0.feet[0] ? "left" : "right";
                link.act(scene.id, "highfive", id);
              });
            },
            stopFollowing,
            setMine(next) {
              me0.status = next.status;
              me0.trained = next.trained;
              send();
            },
            doSpot(id) {
              stopFollowing();
              const spot = scene.spots.find((s) => s.id === id);
              move({ kind: "spot", id }, () => (spot ? onArriveRef.current?.({ spot }) : undefined));
            },
            setPieces(next) {
              pieces = next.flatMap((r) => toPlacement(r) ?? []);
              // Every room has a clothing rack (not its extra spaces): at its own place, or the first free one.
              if (scene.owner && !scene.space) {
                const rack: Placement = { id: RACK.id, item: RACK, ...RACK_AT, flip: false };
                const at = fits(baseGrid, rack, pieces) ? RACK_AT : freeSpot(baseGrid, rack, pieces);
                if (at) pieces.push({ ...rack, ...at });
              }
              if (selectedPiece && !pieces.some((p) => p.id === selectedPiece)) selectedPiece = null;
              refreshPieces();
            },
            setFurnishing(on) {
              furnishing = on;
              selectedPiece = null;
              movingOk = true;
              if (on) {
                // See the whole room while furnishing.
                follow = false;
                zoomTo = zoomLimits().overview;
              }
            },
            spotFor(piece) {
              const p = toPlacement({ ...piece, u: 0, v: 0 });
              return p ? freeSpot(baseGrid, p, pieces) : null;
            },
            selectPiece(id) {
              selectedPiece = id;
              movingOk = true;
            },
            canPlace(piece) {
              const p = toPlacement(piece);
              return Boolean(p && fits(baseGrid, p, pieces));
            },
          };

        // Debug only: drive the character from the console (window.__wereld.tap(x, y) in background pixels).
        if (debug) (window as unknown as { __wereld?: unknown }).__wereld = { tap: (x: number, y: number) => tapScene([x, y]), me: me0, others, api: apiRef?.current };

        // Placement mode: what is under the finger.
        const HIT = 34; // screen pixels
        const hitSeat = (sx: number, sy: number): { id: string; part: "hip" | "approach" } | null => {
          const p = screenToScene(sx, sy, cam, view);
          const r = HIT / cam.zoom;
          let best: { id: string; part: "hip" | "approach"; d: number } | null = null;
          for (const s of seatsRef.current) {
            for (const part of ["hip", "approach"] as const) {
              const d = dist(s[part], p);
              if (d <= r && (!best || d < best.d)) best = { id: s.id, part, d };
            }
          }
          return best ? { id: best.id, part: best.part } : null;
        };
        let dragging: { id: string; part: "hip" | "approach" } | null = null;

        let lastTap = { t: -Infinity, x: 0, y: 0 };
        detach = attachInput(canvas, {
          tap(x, y) {
            if (furnishing) {
              const hit = pieceAt(x, y);
              selectedPiece = hit ? hit.id : null;
              movingOk = true;
              onPieceSelectedRef.current?.(selectedPiece);
              return;
            }
            if (!edit) {
              const now = performance.now();
              // Double tap: switch between the whole picture and close to your character.
              if (now - lastTap.t < 320 && Math.hypot(x - lastTap.x, y - lastTap.y) < 40) {
                lastTap = { t: -Infinity, x: 0, y: 0 };
                zoomTo = toggledZoom(cam.zoom, zoomLimits());
                follow = true;
                return;
              }
              lastTap = { t: now, x, y };
              // Tapping someone shows who it is instead of walking.
              if (pick(x, y)) return;
              follow = true;
              // The clothing rack: walk up to it, then choose what to wear.
              const rack = pieceAt(x, y, true);
              if (rack?.id === RACK.id) return goToRack(rack);
              tapScene(screenToScene(x, y, cam, view));
              return;
            }
            const hit = hitSeat(x, y);
            if (hit) {
              commit(seatsRef.current, hit.id);
              return;
            }
            // A new seat where you tapped: that is where the hips go.
            const hip = round(screenToScene(x, y, cam, view));
            const approach = approachFor(grid, hip);
            if (!approach) {
              say("Hier is geen vloer in de buurt om naartoe te lopen.");
              return;
            }
            let n = seatsRef.current.length + 1;
            while (seatsRef.current.some((s) => s.id === `zit-${n}`)) n++;
            const seat: Seat = { id: `zit-${n}`, hip, facing: "right", approach: round(approach) };
            commit([...seatsRef.current, seat], seat.id);
          },
          grab(x, y) {
            if (furnishing) {
              const hit = pieceAt(x, y);
              if (!hit) return false;
              selectedPiece = hit.id;
              onPieceSelectedRef.current?.(hit.id);
              const [fu, fv] = baseGrid.pxToTile(screenToScene(x, y, cam, view));
              movingPiece = { id: hit.id, from: { u: hit.u, v: hit.v }, grab: [fu - hit.u, fv - hit.v] };
              return true;
            }
            if (!edit) return false;
            dragging = hitSeat(x, y);
            if (dragging) commit(seatsRef.current, dragging.id);
            return Boolean(dragging);
          },
          drag(x, y) {
            if (movingPiece) {
              const p = pieces.find((q) => q.id === movingPiece!.id);
              if (!p) return;
              const [fu, fv] = baseGrid.pxToTile(screenToScene(x, y, cam, view));
              p.u = Math.round(fu - movingPiece.grab[0]);
              p.v = Math.round(fv - movingPiece.grab[1]);
              movingOk = fits(baseGrid, p, pieces);
              return;
            }
            if (!dragging) return;
            const p = round(screenToScene(x, y, cam, view));
            const { id, part } = dragging;
            seatsRef.current = seatsRef.current.map((s) => (s.id === id ? { ...s, [part]: p } : s));
          },
          drop() {
            if (movingPiece) {
              const p = pieces.find((q) => q.id === movingPiece!.id);
              const from = movingPiece.from;
              movingPiece = null;
              if (!p) return;
              if (fits(baseGrid, p, pieces)) {
                refreshPieces();
                onPieceMovedRef.current?.({ id: p.id, itemId: p.item.id, u: p.u, v: p.v, flip: p.flip });
              } else {
                p.u = from.u;
                p.v = from.v;
                say("Daar past het niet.");
              }
              movingOk = true;
              return;
            }
            if (!dragging) return;
            const { id, part } = dragging;
            dragging = null;
            // The walking spot snaps to the centre of the nearest free tile.
            const next = seatsRef.current.map((s) => {
              if (s.id !== id || part !== "approach") return s;
              const t = grid.nearestWalkable(s.approach);
              return t ? { ...s, approach: round(grid.tileToPx(t[0] + 0.5, t[1] + 0.5)) } : s;
            });
            commit(next, id);
          },
          pan(dx, dy) {
            follow = false;
            zoomTo = null;
            cam = clampCamera({ ...cam, x: cam.x - dx / cam.zoom, y: cam.y - dy / cam.zoom }, scene, view);
          },
          zoom(factor, x, y) {
            follow = false;
            zoomTo = null;
            const { min, max } = zoomLimits();
            const before = screenToScene(x, y, cam, view);
            const zoom = Math.min(max, Math.max(min, cam.zoom * factor));
            const nx = before[0] - (x - view.width / 2) / zoom;
            const ny = before[1] - (y - view.height / 2) / zoom;
            cam = clampCamera({ x: nx, y: ny, zoom }, scene, view);
          },
        });

        setStatus("ready");
        let last = performance.now();
        let first = true;
        let followCheck = 0;
        let frames = 0;
        let fpsSince = last;
        const frame = (now: number) => {
          if (!alive) return;
          const dt = Math.min(0.05, (now - last) / 1000);
          last = now;
          // Frames per second, in the debug view only.
          if (overlay && fpsRef.current) {
            frames++;
            if (now - fpsSince >= 500) {
              fpsRef.current.textContent = `${Math.round((frames * 1000) / (now - fpsSince))} fps`;
              frames = 0;
              fpsSince = now;
            }
          }
          for (const a of avatars) {
            step(a, dt, now);
            endAction(a, now);
          }
          if (pet && !furnishing) stepPet(pet, dt, now, petRoute);
          // Walking along: keep close to them, a step behind.
          if (following && now - followCheck > 400) {
            followCheck = now;
            const o = others.get(following);
            if (!o || !o.live) {
              stopFollowing();
            } else {
              const t = o.av.feet;
              const near = scene.characterHeight * 0.75;
              const moved = !followGoal || dist(followGoal, t) > scene.characterHeight * 0.5;
              if (dist(me0.feet, t) > near && moved) {
                const d = dist(me0.feet, t) || 1;
                const dest: Pt = [t[0] + ((me0.feet[0] - t[0]) / d) * near * 0.7, t[1] + ((me0.feet[1] - t[1]) / d) * near * 0.7];
                followGoal = t;
                const from = me0.feet;
                if (startIntent(me0, scene, grid, { kind: "stand", to: dest }, now, mine, remember) === "ok") publish({ kind: "stand", to: dest }, from);
              }
            }
          }
          // Camera: ease to the zoom asked for, and follow your character a bit ahead of where it walks.
          let zoom = cam.zoom;
          if (zoomTo !== null) {
            zoom = ease(zoom, zoomTo, 9, dt);
            if (Math.abs(zoom - zoomTo) < zoomTo * 0.002) {
              zoom = zoomTo;
              zoomTo = null;
            }
          }
          let { x, y } = cam;
          if (follow && !edit) {
            const h = me0.state === "walk" ? heading(me0.feet, me0.path[0]) : ([0, 0] as Pt);
            lead = [ease(lead[0], h[0], 2.2, dt), ease(lead[1], h[1], 2.2, dt)];
            const [tx, ty] = followTarget(me0.feet, lead, scene, view, zoom);
            x = ease(x, tx, 3.5, dt);
            y = ease(y, ty, 3.5, dt);
          }
          if (zoom !== cam.zoom || x !== cam.x || y !== cam.y) cam = clampCamera({ x, y, zoom }, scene, view);
          const current = live();
          render({ ctx, scene: current, background, outlines, avatars, characters, cam, view, now, grid, debug: overlay || edit, page, props: [...propsNow(), ...petProp(now), ...wheelProp(now)], seatDepth: seatDepth(), labels: edit ? undefined : { me: me.id, selected: picked, unread, typing, statusIcons: STATUSES, chat: { lines: (chatLines = liveLines(chatLines, now)), top: chatTop } } });
          if (edit) {
            const sel = current.seats.find((s) => s.id === selectedRef.current);
            if (sel) drawSeatMarker(ctx, sel, true);
          }
          if (first) {
            first = false;
            onReadyRef.current?.();
          }
          raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);
      } catch {
        if (alive) setStatus("error");
      }
    })();

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      clearTimeout(noteTimer);
      clearTimeout(saveTimer);
      flushSave?.();
      offHide?.();
      detach?.();
      cleanupLink?.();
      if (apiRef) apiRef.current = null;
      ro?.disconnect();
      actionsRef.current = null;
    };
  }, [scene, me.id, me.name, me.character, startX, startY, debug, overlay, edit, arriveAt, restore, link, apiRef]);

  // Delete removes the selected seat (keyboard, placement mode).
  useEffect(() => {
    if (!edit) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedRef.current && !(e.target instanceof HTMLInputElement)) {
        commit(
          seatsRef.current.filter((s) => s.id !== selectedRef.current),
          null,
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [edit]);

  const current = seats.find((s) => s.id === selected) ?? null;

  async function save() {
    const payload = { scene: scene.id, seats: seatsRef.current };
    setSaveState("Opslaan…");
    try {
      const res = await fetch("/api/wereld/zitplekken", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (res.ok) {
        setSaveState(`Opgeslagen in ${scene.id}.zitplekken.json`);
        return;
      }
    } catch {}
    // Not on your own computer: copy the JSON so it can go into the file by hand.
    try {
      await navigator.clipboard.writeText(JSON.stringify({ seats: seatsRef.current }, null, 2) + "\n");
      setSaveState("Opslaan in het bestand kan alleen lokaal. De JSON staat op je klembord.");
    } catch {
      setSaveState("Opslaan lukte niet. Gebruik de placement mode lokaal (npm run dev:demo).");
    }
  }

  return (
    <div className="absolute inset-0">
      <div ref={boxRef} className="absolute inset-0 touch-none select-none overflow-hidden bg-[#f6ece4]">
        <canvas ref={canvasRef} className="block h-full w-full" aria-label={`${scene.name}: tik om te lopen, sleep om rond te kijken`} role="img" />
        {status !== "ready" ? (
          <div className="absolute inset-0 grid place-items-center text-[14px] text-muted">{status === "loading" ? "De wereld laadt…" : "De wereld kon niet laden. Probeer het opnieuw."}</div>
        ) : null}
        {overlay ? <p ref={fpsRef} className="absolute right-3 rounded-full bg-text/80 px-3 py-1 text-[12px] tabular-nums text-paper" style={{ top: "calc(var(--sat) + 14px)" }} aria-live="off" /> : null}
        {note ? (
          <p className="absolute inset-x-4 mx-auto max-w-md rounded-full bg-text/90 px-4 py-2 text-center text-[13px] text-paper" style={{ top: "calc(var(--sat) + 68px)" }} role="status">
            {note}
          </p>
        ) : null}
      </div>

      {edit ? (
        <section
          aria-label="Plaatsingsmodus"
          className="absolute inset-x-3 mx-auto max-h-[42dvh] max-w-xl space-y-3 overflow-y-auto rounded-[20px] bg-white/92 p-4 shadow-lg ring-1 ring-ink/[0.06] backdrop-blur"
          style={{ bottom: "calc(var(--sab) + 12px)" }}
        >
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">Plaatsingsmodus · {scene.name}</p>
            <p className="mt-1 text-[13px] leading-snug text-text">
              Tik op de zitting van een bank of stoel: daar komen de heupen. Sleep het <span className="font-semibold text-[#b52f74]">roze punt</span> om te verplaatsen en het{" "}
              <span className="font-semibold text-[#3f8f4f]">groene punt</span> voor de plek waar je naartoe loopt. Slepen naast de punten kijkt rond.
            </p>
          </div>

          {current ? (
            <div className="space-y-2 rounded-[16px] bg-[#f6ece4] p-3">
              <p className="text-[13px] font-medium text-text">
                {current.id} · heupen ({current.hip[0]}, {current.hip[1]}) · loopt naar ({current.approach[0]}, {current.approach[1]})
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="h-10 rounded-full bg-white px-4 text-[13px] font-medium text-ink ring-1 ring-ink/10"
                  onClick={() => commit(seatsRef.current.map((s) => (s.id === current.id ? { ...s, facing: s.facing === "left" ? "right" : "left" } : s)))}
                >
                  Kijkt naar {current.facing === "left" ? "links" : "rechts"} · wissel
                </button>
                <button type="button" className="h-10 rounded-full bg-white px-4 text-[13px] font-medium text-ink ring-1 ring-ink/10" onClick={() => actionsRef.current?.tryOut(current.id)}>
                  Probeer met je poppetje
                </button>
                <button
                  type="button"
                  className="h-10 rounded-full bg-danger/15 px-4 text-[13px] font-medium text-danger"
                  onClick={() =>
                    commit(
                      seatsRef.current.filter((s) => s.id !== current.id),
                      null,
                    )
                  }
                >
                  Verwijder
                </button>
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-muted">Geen zitplek gekozen. Tik op een roze punt om er een te kiezen.</p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={save} className="espresso h-11 rounded-full px-5 text-[14px] font-semibold">
              Opslaan ({seats.length} zitplekken)
            </button>
            {saveState ? <p className="text-[12.5px] text-muted" role="status">{saveState}</p> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
