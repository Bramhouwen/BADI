/**
 * What goes over the live world channel. Only intents are shared ("from
 * here, to there"), never routes; speech balloons are broadcast and never
 * stored. Everything that comes in is checked, so a broken or hostile
 * message is ignored instead of breaking the world.
 */
import type { Pt } from "./geometry";
import type { Intent } from "./moves";

/** Where someone is and what they are doing, as shared on the channel (presence). */
export interface WorldPresence {
  v: 1;
  name: string;
  character: string;
  scene: string;
  /** Where the current move started, in background pixels of `scene`. */
  from: Pt;
  intent: Intent;
  /** When the move started (ms since 1970, the sender's clock). */
  at: number;
}

export interface Speech {
  from: string;
  scene: string;
  text: string;
}

export const SPEECH_MAX = 120;
/** How long a balloon stays up: a few seconds, longer for longer lines. */
export function speechSeconds(text: string): number {
  return Math.min(9, 3.5 + text.length * 0.06);
}

const ID = /^[a-z0-9-]{1,40}$/;
const isPt = (v: unknown): v is Pt => Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === "number" && Number.isFinite(n) && n >= -100 && n <= 10000);

function readIntent(v: unknown): Intent | null {
  const r = v as Record<string, unknown> | null;
  if (!r || typeof r !== "object") return null;
  if (r.kind === "stand" && isPt(r.to)) return { kind: "stand", to: [r.to[0], r.to[1]] };
  if ((r.kind === "seat" || r.kind === "spot") && typeof r.id === "string" && ID.test(r.id)) return { kind: r.kind, id: r.id };
  return null;
}

export function readPresence(v: unknown): WorldPresence | null {
  const r = v as Record<string, unknown> | null;
  if (!r || typeof r !== "object" || r.v !== 1) return null;
  if (typeof r.name !== "string" || r.name.length < 1 || r.name.length > 40) return null;
  if (typeof r.character !== "string" || !ID.test(r.character)) return null;
  if (typeof r.scene !== "string" || !ID.test(r.scene)) return null;
  if (!isPt(r.from) || typeof r.at !== "number" || !Number.isFinite(r.at)) return null;
  const intent = readIntent(r.intent);
  if (!intent) return null;
  return { v: 1, name: r.name, character: r.character, scene: r.scene, from: [r.from[0], r.from[1]], intent, at: r.at };
}

/** A line someone said, cleaned up: one line, no more than SPEECH_MAX characters. */
export function cleanSpeech(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, SPEECH_MAX);
}

export function readSpeech(v: unknown): Speech | null {
  const r = v as Record<string, unknown> | null;
  if (!r || typeof r !== "object") return null;
  if (typeof r.from !== "string" || r.from.length > 64 || typeof r.scene !== "string" || !ID.test(r.scene) || typeof r.text !== "string") return null;
  const text = cleanSpeech(r.text);
  return text ? { from: r.from, scene: r.scene, text } : null;
}

/**
 * How far into a move someone is when you first see them, in seconds. Clocks
 * on two phones differ a little, so this is kept within reason.
 */
export function secondsSince(at: number, nowMs: number): number {
  return Math.max(0, Math.min(120, (nowMs - at) / 1000));
}
