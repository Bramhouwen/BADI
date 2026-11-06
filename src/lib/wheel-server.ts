import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getSquad, type AppContext } from "@/lib/data";
import { signedUrlMap } from "@/lib/storage";
import { addDays, todayKey, type DateKey } from "@/lib/dates";
import { weekStartOf } from "@/lib/checkin-plan";
import { firstName } from "@/lib/utils";
import {
  DEFAULT_WEIGHTS,
  WHEEL_CATEGORIES,
  challengeProgress,
  wheelOdds,
  type ChallengeProgress,
  type Odds,
  type PrizeCategory,
  type SpinStatus,
  type WheelCategory,
  type WheelChallengeKey,
} from "@/lib/wheel";

export interface PrizeRow {
  id: string;
  challenge_id: string;
  category: PrizeCategory;
  brand: string;
  name: string;
  description: string | null;
  value_cents: number | null;
  url: string | null;
  image_path: string | null;
  variant_label: string | null;
  variants: string[];
  needs_code: boolean;
  stock: number;
  weekly_max: number | null;
  weight: number;
  cost_cents: number;
  sponsored_cents: number;
  shipping_cents: number;
  active: boolean;
}

export interface SpinRow {
  id: string;
  user_id: string;
  week_start: DateKey;
  category: WheelCategory;
  prize_id: string | null;
  prize_brand: string | null;
  prize_name: string | null;
  cost_cents: number;
  challenge_key: WheelChallengeKey | null;
  challenge_completed_at: string | null;
  variant: string | null;
  status: SpinStatus;
  created_at: string;
  claimed_at: string | null;
  delivered_at: string | null;
}

export const SPIN_COLUMNS = "id, user_id, week_start, category, prize_id, prize_brand, prize_name, cost_cents, challenge_key, challenge_completed_at, variant, status, created_at, claimed_at, delivered_at";

export async function loadWeights(challengeId: string): Promise<Record<WheelCategory, number>> {
  const supabase = await createClient();
  const { data } = await supabase.from("wheel_categories").select("key, weight").eq("challenge_id", challengeId);
  const out = { ...DEFAULT_WEIGHTS };
  for (const r of (data ?? []) as { key: WheelCategory; weight: number }[]) if (WHEEL_CATEGORIES.includes(r.key)) out[r.key] = r.weight;
  return out;
}

export async function loadPrizes(challengeId: string): Promise<PrizeRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("prizes").select("*").eq("challenge_id", challengeId).order("category").order("brand");
  return ((data ?? []) as PrizeRow[]).map((p) => ({ ...p, variants: p.variants ?? [] }));
}

/** Prize photos as signed URLs, by prize id. */
export async function prizeImages(prizes: readonly Pick<PrizeRow, "id" | "image_path">[]): Promise<Map<string, string>> {
  const urls = await signedUrlMap("prizes", prizes.map((p) => p.image_path).filter((p): p is string => Boolean(p)));
  const out = new Map<string, string>();
  for (const p of prizes) if (p.image_path && urls.get(p.image_path)) out.set(p.id, urls.get(p.image_path)!);
  return out;
}

export interface WheelState {
  weekStart: DateKey;
  today: DateKey;
  /** Server time of the load, for the countdown's first render. */
  now: number;
  odds: Odds[];
  mySpin: SpinRow | null;
  /** Available prizes per level, for "Te winnen". */
  pool: Record<PrizeCategory, { brand: string; name: string }[]>;
}

export async function loadWheelState(ctx: AppContext): Promise<WheelState> {
  const supabase = await createClient();
  const today = todayKey(new Date(), ctx.challenge.timezone);
  const weekStart = weekStartOf(today);
  const [weights, prizes, { data: weekSpins }, { data: availableIds }] = await Promise.all([
    loadWeights(ctx.challenge.id),
    loadPrizes(ctx.challenge.id),
    supabase.from("wheel_spins").select(SPIN_COLUMNS).eq("challenge_id", ctx.challenge.id).eq("week_start", weekStart),
    // The database decides (stock, weekly cap and budget); members never see the budget itself.
    supabase.rpc("wheel_available_ids", { p_challenge: ctx.challenge.id }),
  ]);
  const spins = (weekSpins ?? []) as SpinRow[];
  const ids = new Set(((availableIds ?? []) as (string | { wheel_available_ids: string })[]).map((r) => (typeof r === "string" ? r : r.wheel_available_ids)));
  const available = prizes.filter((p) => ids.has(p.id));
  const pool = { small: [], medium: [], large: [], jackpot: [] } as WheelState["pool"];
  for (const p of available) pool[p.category].push({ brand: p.brand, name: p.name });
  return { weekStart, today, now: Date.now(), odds: wheelOdds(weights, available), mySpin: spins.filter((s) => s.user_id === ctx.userId).at(-1) ?? null, pool };
}

/**
 * Progress of my extra week challenge from my own data, and marks it
 * completed once everything is done (that counts as +5 bonus).
 */
export async function myChallengeProgress(ctx: AppContext, spin: SpinRow): Promise<ChallengeProgress | null> {
  if (spin.category !== "challenge" || !spin.challenge_key) return null;
  const supabase = await createClient();
  const weekStart = spin.week_start;
  const weekEnd = addDays(weekStart, 6);
  const today = todayKey(new Date(), ctx.challenge.timezone);
  const key = spin.challenge_key;
  const inWeek = (iso: string) => {
    const d = todayKey(new Date(iso), ctx.challenge.timezone);
    return d >= weekStart && d <= weekEnd;
  };
  const [{ data: compliments }, { data: recipes }, squad] = await Promise.all([
    key === "buddy" ? supabase.from("compliments").select("receiver_id, created_at").eq("sender_id", ctx.userId).gte("created_at", addDays(weekStart, -1)) : Promise.resolve({ data: [] }),
    key === "recipe" ? supabase.from("recipes").select("created_at").eq("user_id", ctx.userId).eq("challenge_id", ctx.challenge.id).gte("created_at", addDays(weekStart, -1)) : Promise.resolve({ data: [] }),
    key === "buddy" ? getSquad(ctx.challenge.id) : Promise.resolve([]),
  ]);
  const sentTo = new Set(((compliments ?? []) as { receiver_id: string; created_at: string }[]).filter((c) => inWeek(c.created_at)).map((c) => c.receiver_id));
  const progress = challengeProgress(key, weekStart, today, {
    buddies: squad.filter((m) => m.user_id !== ctx.userId).map((m) => ({ id: m.user_id, name: firstName(m.profile.display_name), sent: sentTo.has(m.user_id) })),
    recipes: ((recipes ?? []) as { created_at: string }[]).filter((r) => inWeek(r.created_at)).length,
    completedAt: spin.challenge_completed_at,
  });
  if (progress.complete && !spin.challenge_completed_at && spin.user_id === ctx.userId) {
    await supabase.rpc("complete_wheel_challenge", { p_spin: spin.id });
    spin.challenge_completed_at = new Date().toISOString();
  }
  return progress;
}
