"use client";

import { useEffect, useRef, useState } from "react";
import { saveWorldPosition } from "@/app/actions/world";
import { newAvatar, step, walkSpeedFor, type Avatar } from "@/lib/world/engine/avatar";
import { dist, pointInPolygon, type Pt } from "@/lib/world/engine/geometry";
import { buildGrid, type Grid } from "@/lib/world/engine/grid";
import { ease, followTarget, heading, startZoom, toggledZoom, zoomLevels } from "@/lib/world/engine/camera";
import { attachInput } from "@/lib/world/engine/input";
import { fastForward, placeAtEnd, startIntent, type Abilities, type Intent } from "@/lib/world/engine/moves";
import { secondsSince, speechSeconds, type WorldPresence } from "@/lib/world/engine/presence";
import { avatarAt, clampCamera, drawSeatMarker, render, screenToScene, type Camera, type View } from "@/lib/world/engine/renderer";
import { seatAt } from "@/lib/world/engine/seats";
import { loadCharacter, type LoadedCharacter } from "@/lib/world/engine/sprites";
import type { Door, SceneDef, Seat } from "@/lib/world/engine/scene";
import type { WorldLink } from "./world-link";

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
}

/** Who you tapped. */
export interface PickedMember {
  id: string;
  name: string;
  online: boolean;
  /** When they were last in the world, for someone offline. */
  lastSeen: string | null;
}

/**
 * One scene of BADI Wereld on a canvas: your character walks where you tap,
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
}: {
  scene: SceneDef;
  me: { id: string; name: string; character: string | null };
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
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const fpsRef = useRef<HTMLParagraphElement>(null);
  // Latest callbacks, so a new function from the parent does not restart the scene.
  const onDoorRef = useRef(onDoor);
  const onReadyRef = useRef(onReady);
  const onPickRef = useRef(onPick);
  const membersRef = useRef(members);
  useEffect(() => {
    onDoorRef.current = onDoor;
    onReadyRef.current = onReady;
    onPickRef.current = onPick;
    membersRef.current = members;
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
    let detach: (() => void) | null = null;
    let cleanupLink: (() => void) | null = null;
    let ro: ResizeObserver | null = null;
    const say = (text: string) => {
      setNote(text);
      clearTimeout(noteTimer);
      noteTimer = setTimeout(() => setNote(null), 3200);
    };
    // The scene as it is being edited: same as `scene`, with the seats from the placement mode.
    const live = (): SceneDef => (edit ? { ...scene, seats: seatsRef.current } : scene);

    const grid = buildGrid(scene);
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
        const [background, character] = await Promise.all([loadImage(scene.background), loadCharacter(me.character!)]);
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
        const mine = abilities(character);
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
          saveTimer = setTimeout(() => void saveWorldPosition({ scene: scene.id, x: me0.feet[0], y: me0.feet[1], activity: activityOf(me0) }), 1200);
        };
        // Tell the others: only where you start from and what you are going to do.
        const publish = (intent: Intent, from: Pt) => {
          if (edit || !link) return;
          link.publish({ v: 1, name: me.name, character: character.key, scene: scene.id, from, intent, at: Date.now() });
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
          const door = scene.doors.find((d) => pointInPolygon(p, d.tap));
          if (door) {
            move({ kind: "stand", to: door.approach }, () => {
              if (door.to && onDoorRef.current) onDoorRef.current(door);
              else say("Deze deur gaat nog nergens heen.");
            });
            return;
          }
          const spot = scene.spots.find((s) => pointInPolygon(p, s.tap));
          if (spot) return move({ kind: "spot", id: spot.id });
          const seat = seatAt(live(), p);
          if (seat) return move({ kind: "seat", id: seat.id });
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
            const o = ensure(m.id, m.name, m.character, [m.x, m.y]);
            o.av.offline = true;
            o.lastSeen = m.updatedAt;
            withCharacter(m.character, (c) => {
              if (o.live) return;
              placeAtEnd(o.av, scene, restPose(intentOf(m.activity), [m.x!, m.y!]), performance.now(), abilities(c));
            });
          }
        };
        const applyPeer = (id: string, p: WorldPresence) => {
          if (p.scene !== scene.id) {
            if (others.get(id)?.live) drop(id);
            return;
          }
          const first = !others.get(id)?.live;
          const o = ensure(id, p.name, p.character, p.from);
          o.live = true;
          o.av.offline = false;
          o.lastSeen = null;
          if (o.at === p.at) return;
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
            if (o.intent && c) placeAtEnd(o.av, scene, restPose(o.intent, o.intent.kind === "stand" ? o.intent.to : o.av.feet), performance.now(), abilities(c));
            else drop(id);
          }
        };
        showOffline();
        let unsubscribe: (() => void) | null = null;
        if (link && !edit) {
          syncPeers();
          unsubscribe = link.subscribe((e) => {
            if (!alive) return;
            if (e.type === "peers") return syncPeers();
            if (e.scene !== scene.id) return;
            const who = e.from === me.id ? me0 : others.get(e.from)?.av;
            if (who) who.speech = { text: e.text, until: performance.now() + speechSeconds(e.text) * 1000 };
          });
          publish(restored ?? { kind: "stand", to: me0.feet }, me0.feet);
        }
        cleanupLink = () => unsubscribe?.();
        // Coming in through a door: that is your place in this scene now.
        if (door) remember();
        let picked: string | null = null;
        const pick = (sx: number, sy: number): boolean => {
          const hit = avatarAt(sx, sy, avatars.filter((a) => a !== me0), characters, scene, cam, view);
          picked = hit ? hit.id : null;
          const o = hit ? others.get(hit.id) : null;
          onPickRef.current?.(hit && o ? { id: hit.id, name: hit.name, online: o.live, lastSeen: o.lastSeen } : null);
          return Boolean(hit);
        };

        // Debug only: drive the character from the console (window.__wereld.tap(x, y) in background pixels).
        if (debug) (window as unknown as { __wereld?: unknown }).__wereld = { tap: (x: number, y: number) => tapScene([x, y]), me: me0, others };

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
            if (!edit) return false;
            dragging = hitSeat(x, y);
            if (dragging) commit(seatsRef.current, dragging.id);
            return Boolean(dragging);
          },
          drag(x, y) {
            if (!dragging) return;
            const p = round(screenToScene(x, y, cam, view));
            const { id, part } = dragging;
            seatsRef.current = seatsRef.current.map((s) => (s.id === id ? { ...s, [part]: p } : s));
          },
          drop() {
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
          for (const a of avatars) step(a, dt, now);
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
          render({ ctx, scene: current, background, outlines, avatars, characters, cam, view, now, grid, debug: overlay || edit, page, labels: edit ? undefined : { me: me.id, selected: picked } });
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
      detach?.();
      cleanupLink?.();
      ro?.disconnect();
      actionsRef.current = null;
    };
  }, [scene, me.id, me.name, me.character, startX, startY, debug, overlay, edit, arriveAt, restore, link]);

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
