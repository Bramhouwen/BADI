"use client";

/**
 * The live link between everyone in World of Badi: a private Supabase Realtime
 * channel per group ('wereld:<challenge id>', members only, migration 0031).
 * Presence carries where you are and what you are doing (an intent, never a
 * route); broadcast carries speech balloons. Nothing of it is stored.
 *
 * In demo mode there is no Supabase: two squad members walk around, sit, run
 * and say something now and then, so the world can be tried alone.
 */
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { isDemo } from "@/lib/demo";
import { SCENES } from "@/lib/world/scenes";
import { buildGrid } from "@/lib/world/engine/grid";
import type { Pt } from "@/lib/world/engine/geometry";
import type { Intent } from "@/lib/world/engine/moves";
import { cleanSpeech, readAction, readPresence, readSpeech, type ActionKind, type Speech, type WorldAction, type WorldPresence } from "@/lib/world/engine/presence";
import { WHEEL_CATEGORIES, WHEEL_CHALLENGES, type WheelCategory, type WheelChallengeKey } from "@/lib/wheel";
import { WHEEL_SCENE, WHEEL_SQUARES, ringState } from "@/lib/world/wheel-ring";

/** Someone spun the Weekrad in the back garden: where it lands, the same on every phone. */
export interface WheelSpinEvent {
  from: string;
  name: string;
  category: WheelCategory;
  /** 0 to 1: which slice of that level and where in it. */
  seed: number;
  /** What came out, for everyone to see when the wheel stops: a prize, or the extra challenge. */
  prize?: { brand: string | null; name: string | null; image: string | null } | null;
  challenge?: WheelChallengeKey | null;
}

const text = (v: unknown, max: number) => (typeof v === "string" && v.length <= max ? v : null);

function readWheelSpin(v: unknown): WheelSpinEvent | null {
  const r = v as Record<string, unknown> | null;
  if (!r || typeof r !== "object") return null;
  if (typeof r.from !== "string" || r.from.length > 64 || typeof r.name !== "string" || r.name.length > 40) return null;
  if (typeof r.category !== "string" || !(WHEEL_CATEGORIES as readonly string[]).includes(r.category)) return null;
  if (typeof r.seed !== "number" || !(r.seed >= 0 && r.seed <= 1)) return null;
  const p = r.prize as Record<string, unknown> | null | undefined;
  const prize = p && typeof p === "object" ? { brand: text(p.brand, 120), name: text(p.name, 200), image: text(p.image, 2000) } : null;
  const challenge = typeof r.challenge === "string" && (WHEEL_CHALLENGES as readonly string[]).includes(r.challenge) ? (r.challenge as WheelChallengeKey) : null;
  return { from: r.from, name: r.name, category: r.category as WheelCategory, seed: r.seed, prize, challenge };
}

export type LinkEvent = { type: "peers" } | ({ type: "speech" } & Speech) | ({ type: "action" } & WorldAction) | ({ type: "wheel" } & WheelSpinEvent);

export interface WorldLink {
  /** Shares where you are and what you are doing now. */
  publish(p: WorldPresence): void;
  /** Says something to everyone in the scene; also shown over yourself. */
  say(scene: string, text: string): void;
  /** Does something for the room to see: wave, cheer, dance, a high five; `to` someone or nobody. Also shown on yourself. */
  act(scene: string, kind: ActionKind, to: string | null): void;
  subscribe(listener: (e: LinkEvent) => void): () => void;
  /** Everyone else in the world right now, by user id. */
  peers(): ReadonlyMap<string, WorldPresence>;
  /** What you share yourself (null before your first move). */
  self(): WorldPresence | null;
  /** You spun the Weekrad: everyone sees the wheel land there. Also shown to yourself. */
  wheel(spin: Omit<WheelSpinEvent, "from">): void;
  close(): void;
}

class Listeners {
  private set = new Set<(e: LinkEvent) => void>();
  add(l: (e: LinkEvent) => void) {
    this.set.add(l);
    return () => void this.set.delete(l);
  }
  emit(e: LinkEvent) {
    for (const l of this.set) l(e);
  }
}

export function createWorldLink(userId: string, challengeId: string): WorldLink {
  return isDemo() ? demoLink(userId) : realtimeLink(userId, challengeId);
}

function realtimeLink(userId: string, challengeId: string): WorldLink {
  const listeners = new Listeners();
  let peers = new Map<string, WorldPresence>();
  let mine: WorldPresence | null = null;
  let joined = false;
  let channel: RealtimeChannel | null = null;
  let supabase: ReturnType<typeof createClient> | null = null;
  try {
    supabase = createClient();
  } catch {
    supabase = null;
  }
  const visible = () => typeof document === "undefined" || document.visibilityState === "visible";
  const track = () => {
    if (!channel || !joined) return;
    if (mine && visible()) void channel.track(mine);
    else void channel.untrack();
  };
  if (supabase) {
    channel = supabase.channel(`wereld:${challengeId}`, { config: { private: true, presence: { key: userId } } });
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel!.presenceState() as Record<string, unknown[]>;
        const next = new Map<string, WorldPresence>();
        for (const [id, metas] of Object.entries(state)) {
          if (id === userId) continue;
          // The newest move of someone with the world open on two devices wins.
          let best: WorldPresence | null = null;
          for (const m of metas) {
            const p = readPresence(m);
            if (p && (!best || p.at >= best.at)) best = p;
          }
          if (best) next.set(id, best);
        }
        peers = next;
        listeners.emit({ type: "peers" });
      })
      .on("broadcast", { event: "zeg" }, ({ payload }) => {
        const s = readSpeech(payload);
        if (s && s.from !== userId) listeners.emit({ type: "speech", ...s });
      })
      .on("broadcast", { event: "actie" }, ({ payload }) => {
        const a = readAction(payload);
        if (a && a.from !== userId) listeners.emit({ type: "action", ...a });
      })
      .on("broadcast", { event: "rad" }, ({ payload }) => {
        const w = readWheelSpin(payload);
        if (w && w.from !== userId) listeners.emit({ type: "wheel", ...w });
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          joined = true;
          track();
        }
      });
    document.addEventListener("visibilitychange", track);
  }
  return {
    publish(p) {
      mine = p;
      track();
      listeners.emit({ type: "peers" });
    },
    self: () => mine,
    wheel(spin) {
      const e = { from: userId, ...spin };
      listeners.emit({ type: "wheel", ...e });
      void channel?.send({ type: "broadcast", event: "rad", payload: e });
    },
    say(scene, text) {
      const clean = cleanSpeech(text);
      if (!clean) return;
      listeners.emit({ type: "speech", from: userId, scene, text: clean });
      void channel?.send({ type: "broadcast", event: "zeg", payload: { from: userId, scene, text: clean } });
    },
    act(scene, kind, to) {
      listeners.emit({ type: "action", from: userId, scene, kind, to });
      void channel?.send({ type: "broadcast", event: "actie", payload: { from: userId, scene, kind, to } });
    },
    subscribe: (l) => listeners.add(l),
    peers: () => peers,
    close() {
      document.removeEventListener("visibilitychange", track);
      if (channel) {
        void channel.untrack();
        void supabase?.removeChannel(channel);
      }
      channel = null;
    },
  };
}

/** Demo: Sam (in the living room) and Alex (outside) as characters that walk, sit, run and talk on their own. */
const DEMO_BOTS = [
  { id: "00000000-0000-4000-8000-000000000002", name: "Sam", character: "anne", scene: "woonkamer", start: [1300, 900] as Pt, status: "chillen" as const, trained: true },
  { id: "00000000-0000-4000-8000-000000000003", name: "Alex", character: "daphne", scene: "buiten", start: [900, 520] as Pt, status: "trainen" as const, trained: false },
];
/** Demo: the housemates who come and stand at the Weekrad with you, and spin when it is their turn. */
const DEMO_RING = [
  { id: "00000000-0000-4000-8000-000000000002", name: "Sam", character: "anne" },
  { id: "00000000-0000-4000-8000-000000000003", name: "Alex", character: "daphne" },
  { id: "00000000-0000-4000-8000-000000000004", name: "Noor", character: "irene" },
];
const DEMO_LINES = ["Wie gaat er mee hardlopen?", "Ik heb net mijn stappen gehaald", "Koffie iemand?", "Zullen we vanavond samen trainen?", "Hoi!", "Nog 2 trainingen deze week"];

function demoLink(userId: string): WorldLink {
  const listeners = new Listeners();
  const peers = new Map<string, WorldPresence>();
  const timers: ReturnType<typeof setTimeout>[] = [];
  let closed = false;
  let mine: WorldPresence | null = null;
  // At the Weekrad: who came, and who of them spun already.
  let gathered = false;
  const demoSpun = new Set<string>();
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

  for (const bot of DEMO_BOTS) {
    const scene = SCENES[bot.scene];
    const grid = buildGrid(scene);
    let here: Pt = bot.start;
    const free: Pt[] = [];
    for (let u = 0; u < grid.nu; u++) for (let v = 0; v < grid.nv; v++) if (grid.walk[u][v]) free.push(grid.tileToPx(u + 0.5, v + 0.5));
    const move = () => {
      if (closed || gathered) return;
      const r = Math.random();
      let intent: Intent;
      if (r < 0.3 && scene.seats.length) {
        const seat = pick(scene.seats);
        intent = { kind: "seat", id: seat.id };
        here = seat.hip;
      } else if (r < 0.45 && scene.spots.length) {
        const spot = pick(scene.spots);
        intent = { kind: "spot", id: spot.id };
        here = spot.at;
      } else {
        // somewhere not too far, so you see them walk
        const near = free.filter((p) => Math.hypot(p[0] - here[0], p[1] - here[1]) < scene.characterHeight * 3);
        const to = pick(near.length ? near : free);
        intent = { kind: "stand", to };
        here = to;
      }
      const from = peers.get(bot.id)?.intent;
      const fromPt: Pt = !from ? bot.start : from.kind === "stand" ? from.to : (scene.seats.find((s) => s.id === (from as { id: string }).id)?.hip ?? scene.spots.find((s) => s.id === (from as { id: string }).id)?.at ?? bot.start);
      peers.set(bot.id, { v: 1, name: bot.name, character: bot.character, scene: bot.scene, from: fromPt, intent, at: Date.now(), status: bot.status, trained: bot.trained });
      listeners.emit({ type: "peers" });
      timers.push(setTimeout(move, 7000 + Math.random() * 7000));
    };
    timers.push(setTimeout(move, 800 + Math.random() * 1500));
  }
  const talk = () => {
    if (closed) return;
    const bot = pick(DEMO_BOTS);
    if (Math.random() < 0.35) listeners.emit({ type: "action", from: bot.id, scene: bot.scene, kind: "zwaai", to: userId });
    else listeners.emit({ type: "speech", from: bot.id, scene: bot.scene, text: pick(DEMO_LINES) });
    timers.push(setTimeout(talk, 9000 + Math.random() * 9000));
  };
  timers.push(setTimeout(talk, 4000));

  // Demo: once you are in the back garden, the others come and stand in the free squares, and spin in turn.
  const gather = () => {
    if (closed || gathered || mine?.scene !== WHEEL_SCENE) return;
    gathered = true;
    const garden = SCENES[WHEEL_SCENE];
    const taken = mine.intent.kind === "spot" ? mine.intent.id : null;
    const free = WHEEL_SQUARES.filter((sq) => sq !== taken);
    DEMO_RING.forEach((bot, i) => {
      const square = free[i];
      const spot = garden.spots.find((s) => s.id === square);
      if (!spot) return;
      peers.set(bot.id, { v: 1, name: bot.name, character: bot.character, scene: WHEEL_SCENE, from: garden.doors[0].approach, intent: { kind: "spot", id: square }, at: Date.now(), status: null, trained: false });
    });
    listeners.emit({ type: "peers" });
  };
  const botTurn = () => {
    if (closed || !gathered || !mine) return;
    const standing = new Map<string, string>();
    for (const [id, p] of peers) if (p.scene === WHEEL_SCENE && p.intent.kind === "spot") standing.set(id, p.intent.id);
    if (mine.scene === WHEEL_SCENE && mine.intent.kind === "spot") standing.set(userId, mine.intent.id);
    const ring = ringState([userId, ...DEMO_RING.map((b) => b.id)], standing, demoSpun);
    const bot = DEMO_RING.find((b) => b.id === ring.turn);
    if (!bot) return;
    demoSpun.add(bot.id);
    timers.push(
      setTimeout(() => {
        if (closed) return;
        const category = pick(WHEEL_CATEGORIES);
        listeners.emit({ type: "wheel", from: bot.id, name: bot.name, category, seed: Math.random(), ...(category === "challenge" ? { challenge: pick(WHEEL_CHALLENGES) } : { prize: { brand: "Demo", name: "Een prijs uit de demo", image: null } }) });
        // the next one after this spin has landed
        timers.push(setTimeout(botTurn, 11000));
      }, 2500),
    );
  };

  return {
    publish(p) {
      mine = p;
      listeners.emit({ type: "peers" });
      if (p.scene === WHEEL_SCENE) timers.push(setTimeout(gather, 1500));
      timers.push(setTimeout(botTurn, 1800));
    },
    self: () => mine,
    wheel(spin) {
      demoSpun.add(userId);
      listeners.emit({ type: "wheel", from: userId, ...spin });
      timers.push(setTimeout(botTurn, 11000));
    },
    say(scene, text) {
      const clean = cleanSpeech(text);
      if (clean) listeners.emit({ type: "speech", from: userId, scene, text: clean });
    },
    act(scene, kind, to) {
      listeners.emit({ type: "action", from: userId, scene, kind, to });
      // Demo: a high five or a wave to Sam or Alex is answered.
      const bot = DEMO_BOTS.find((b) => b.id === to);
      if (bot && (kind === "highfive" || kind === "zwaai")) timers.push(setTimeout(() => listeners.emit({ type: "action", from: bot.id, scene: bot.scene, kind, to: userId }), kind === "highfive" ? 50 : 900));
    },
    subscribe: (l) => listeners.add(l),
    peers: () => peers,
    close() {
      closed = true;
      timers.forEach(clearTimeout);
    },
  };
}
