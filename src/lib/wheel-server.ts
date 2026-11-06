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
  availablePrizes,
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
  image_path: string | null;
  variant_label: string | null;
  variants: string[];
  needs_code: boolean;
  stock: number;
  weekly_max: number | null;
  cost_cents: number;
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
  challenge_key: WheelChallengeKey | null;
  challenge_completed_at: string | null;
  variant: string | null;
  status: SpinStatus;
  created_at: string;
  claimed_at: string | null;
  delivered_at: string | null;
}

export const SPIN_COLUMNS = "id, user_id, week_start, category, prize_id, prize_brand, prize_name, challenge_key, challenge_completed_at, variant, status, created_at, claimed_at, delivered_at";

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
  /** Available prizes per category, for "wat kun je winnen". */
  pool: Record<PrizeCategory, { brand: string; name: string }[]>;
}

export async function loadWheelState(ctx: AppContext): Promise<WheelState> {
  const supabase = await createClient();
  const today = todayKey(new Date(), ctx.challenge.timezone);
  const weekStart = weekStartOf(today);
  const [weights, prizes, { data: weekSpins }] = await Promise.all([
    loadWeights(ctx.challenge.id),
    loadPrizes(ctx.challenge.id),
    supabase.from("wheel_spins").select(SPIN_COLUMNS).eq("challenge_id", ctx.challenge.id).eq("week_start", weekStart),
  ]);
  const spins = (weekSpins ?? []) as SpinRow[];
  const wins: Record<string, number> = {};
  for (const s of spins) if (s.prize_id) wins[s.prize_id] = (wins[s.prize_id] ?? 0) + 1;
  const available = availablePrizes(prizes, wins);
  const pool = { food: [], hydration: [], sport: [], voucher: [] } as WheelState["pool"];
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
  const spinDate = todayKey(new Date(spin.created_at), ctx.challenge.timezone);
  const [{ data: water }, { data: checkins }, { data: steps }, { data: workouts }, { data: compliments }, squad] = await Promise.all([
    supabase.from("water_entries").select("log_date, amount_ml").eq("user_id", ctx.userId).gte("log_date", weekStart).lte("log_date", weekEnd),
    supabase.from("daily_checkins").select("checkin_date, activities").eq("user_id", ctx.userId).eq("challenge_id", ctx.challenge.id).gte("checkin_date", weekStart).lte("checkin_date", weekEnd),
    supabase.from("step_logs").select("log_date, steps").eq("user_id", ctx.userId).gte("log_date", weekStart).lte("log_date", weekEnd),
    supabase.from("workout_sessions").select("workout_date").eq("user_id", ctx.userId).eq("status", "completed").gte("workout_date", weekStart).lte("workout_date", weekEnd),
    supabase.from("compliments").select("receiver_id, created_at").eq("sender_id", ctx.userId).gte("created_at", addDays(weekStart, -1)),
    getSquad(ctx.challenge.id),
  ]);
  const waterByDay: Record<string, number> = {};
  for (const w of (water ?? []) as { log_date: string; amount_ml: number }[]) waterByDay[w.log_date] = (waterByDay[w.log_date] ?? 0) + w.amount_ml;
  const sentTo = new Set(
    ((compliments ?? []) as { receiver_id: string; created_at: string }[])
      .filter((c) => {
        const d = todayKey(new Date(c.created_at), ctx.challenge.timezone);
        return d >= weekStart && d <= weekEnd;
      })
      .map((c) => c.receiver_id),
  );
  const progress = challengeProgress(spin.challenge_key, weekStart, spinDate, today, {
    water: waterByDay,
    checkins: Object.fromEntries(((checkins ?? []) as { checkin_date: string; activities: string[] }[]).map((c) => [c.checkin_date, c.activities])),
    steps: Object.fromEntries(((steps ?? []) as { log_date: string; steps: number }[]).map((s) => [s.log_date, s.steps])),
    workoutDates: new Set(((workouts ?? []) as { workout_date: string }[]).map((w) => w.workout_date)),
    buddies: squad.filter((m) => m.user_id !== ctx.userId).map((m) => ({ id: m.user_id, name: firstName(m.profile.display_name), sent: sentTo.has(m.user_id) })),
  });
  if (progress.complete && !spin.challenge_completed_at && spin.user_id === ctx.userId) {
    await supabase.rpc("complete_wheel_challenge", { p_spin: spin.id });
    spin.challenge_completed_at = new Date().toISOString();
  }
  return progress;
}
