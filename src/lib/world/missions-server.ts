import "server-only";

import { createClient } from "@/lib/supabase/server";
import { todayKey } from "@/lib/dates";
import { weekStartOf } from "@/lib/checkin-plan";
import type { AppContext } from "@/lib/data";
import { coinsForDay, dayRecords, missionsFor, type Mission } from "./missions";

export interface WorldGame {
  missions: Mission[];
  /** All coins earned since the challenge started. */
  coins: number;
  /** Earned today. */
  coinsToday: number;
  /** A completed training today: a glow around your character. */
  trainedToday: boolean;
  /** No spin of the Weekrad yet this week. */
  canSpin: boolean;
}

/** Your missions of today and your coins, worked out from your own data in the database. */
export async function loadWorldGame(ctx: AppContext): Promise<WorldGame> {
  const supabase = await createClient();
  const today = todayKey(new Date(), ctx.challenge.timezone);
  const from = ctx.challenge.start_date;
  const [checkins, workouts, water, steps, spins] = await Promise.all([
    supabase.from("daily_checkins").select("checkin_date").eq("challenge_id", ctx.challenge.id).eq("user_id", ctx.userId).gte("checkin_date", from).lte("checkin_date", today),
    supabase.from("workout_sessions").select("workout_date").eq("user_id", ctx.userId).eq("status", "completed").gte("workout_date", from).lte("workout_date", today),
    supabase.from("water_entries").select("log_date, amount_ml").eq("challenge_id", ctx.challenge.id).eq("user_id", ctx.userId).gte("log_date", from).lte("log_date", today),
    supabase.from("step_logs").select("log_date, steps").eq("user_id", ctx.userId).gte("log_date", from).lte("log_date", today),
    supabase.from("wheel_spins").select("id").eq("challenge_id", ctx.challenge.id).eq("user_id", ctx.userId).eq("week_start", weekStartOf(today)).limit(1),
  ]);
  const days = dayRecords({
    checkins: (checkins.data ?? []) as { checkin_date: string }[],
    workouts: (workouts.data ?? []) as { workout_date: string }[],
    water: (water.data ?? []) as { log_date: string; amount_ml: number }[],
    steps: (steps.data ?? []) as { log_date: string; steps: number }[],
  });
  const todayRecord = days.get(today) ?? { checkin: false, training: false, waterMl: 0, steps: 0 };
  let coins = 0;
  for (const d of days.values()) coins += coinsForDay(d);
  return {
    missions: missionsFor(todayRecord),
    coins,
    coinsToday: coinsForDay(todayRecord),
    trainedToday: todayRecord.training,
    // Without the wheel tables (or on an error) there is no button.
    canSpin: !spins.error && (spins.data ?? []).length === 0,
  };
}
