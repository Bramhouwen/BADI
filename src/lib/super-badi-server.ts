import "server-only";

import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSquad, type AppContext } from "@/lib/data";
import { loadBonusItems } from "@/lib/bonus";
import { sendPush } from "@/lib/push";
import { addDays, todayKey } from "@/lib/dates";
import { stepsByDay, weekScore, weekStartOf } from "@/lib/checkin-plan";
import { superBadiMessage, weekWinners, type WeekResult } from "@/lib/super-badi";
import { firstName } from "@/lib/utils";

/**
 * The Super Badi of this week: the winner of last week. The first call after
 * Monday 00:00 works it out, stores it and lets Baddy congratulate in the
 * squad chat; every later call reads the stored result.
 */
export async function currentSuperBadi(ctx: AppContext): Promise<Set<string>> {
  const supabase = await createClient();
  const today = todayKey(new Date(), ctx.challenge.timezone);
  const weekStart = weekStartOf(today);
  const lastWeek = addDays(weekStart, -7);
  const lastEnd = addDays(weekStart, -1);
  // No finished Winter Arc week yet.
  if (lastEnd < ctx.challenge.start_date || lastWeek > ctx.challenge.end_date) return new Set();

  const { data: stored, error: readError } = await supabase.from("super_badi_awards").select("user_ids").eq("challenge_id", ctx.challenge.id).eq("week_start", lastWeek).maybeSingle();
  if (stored) return new Set((stored.user_ids as string[]) ?? []);

  const [squad, { data: checkinRows }, { data: jokerRows }, { data: stepRows }, bonus] = await Promise.all([
    getSquad(ctx.challenge.id),
    supabase.from("daily_checkins").select("user_id, checkin_date, activities").eq("challenge_id", ctx.challenge.id).gte("checkin_date", lastWeek).lte("checkin_date", lastEnd),
    supabase.from("alcohol_exceptions").select("user_id, exception_date").eq("challenge_id", ctx.challenge.id).gte("exception_date", lastWeek).lte("exception_date", lastEnd),
    supabase.from("step_logs").select("user_id, log_date, steps").eq("challenge_id", ctx.challenge.id).gte("log_date", lastWeek).lte("log_date", lastEnd),
    loadBonusItems(ctx.challenge.id, lastWeek, ctx.challenge.timezone),
  ]);
  const checkins = (checkinRows ?? []) as { user_id: string; checkin_date: string; activities: string[] }[];
  const jokers = (jokerRows ?? []) as { user_id: string; exception_date: string }[];
  const steps = (stepRows ?? []) as { user_id: string; log_date: string; steps: number }[];

  const results: WeekResult[] = squad.map((m) => {
    const theirs = checkins.filter((c) => c.user_id === m.user_id);
    const theirSteps = steps.filter((s) => s.user_id === m.user_id);
    const score = weekScore(
      lastWeek,
      theirs,
      jokers.filter((j) => j.user_id === m.user_id).map((j) => j.exception_date),
      theirSteps,
      bonus.filter((b) => b.user_id === m.user_id),
    );
    return {
      id: m.user_id,
      points: score.earned + score.bonus,
      steps: Object.values(stepsByDay(lastWeek, theirSteps, theirs)).reduce((a, b) => a + b, 0),
      days: theirs.length,
    };
  });
  const winners = weekWinners(results);
  // Before migration 0026 the table does not exist: show the result without storing it.
  if (readError) return new Set(winners);

  const names = winners.map((id) => firstName(squad.find((m) => m.user_id === id)?.profile.display_name ?? "Iemand"));
  const points = results.find((r) => r.id === winners[0])?.points ?? 0;
  const body = winners.length ? superBadiMessage(names, points) : "";
  const { data: stored2 } = await supabase.rpc("award_super_badi", { p_challenge: ctx.challenge.id, p_week: lastWeek, p_users: winners, p_body: body });
  if (stored2 === true && body) after(() => sendPush(supabase, "chat", { title: "Super Badi", body, url: "/squad/chat", tag: "squad-chat" }));
  // Someone else may have stored it a moment earlier: read back what counts.
  const { data: final } = await supabase.from("super_badi_awards").select("user_ids").eq("challenge_id", ctx.challenge.id).eq("week_start", lastWeek).maybeSingle();
  return new Set(((final?.user_ids as string[] | undefined) ?? winners));
}
