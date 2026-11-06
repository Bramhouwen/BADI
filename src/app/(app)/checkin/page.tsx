import { Suspense } from "react";
import Link from "next/link";
import { Snowflake, Sparkles } from "lucide-react";
import { requireContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { addDays, challengePhase, daysUntilStart, editableDates, todayKey } from "@/lib/dates";
import { computeStreakStats } from "@/lib/streaks";
import { weekStartOf } from "@/lib/checkin-plan";
import { MAX_ALCOHOL_EXCEPTIONS, type ActivityKey } from "@/lib/constants";
import { Page, PageTitle } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import type { Habit } from "@/lib/habits";
import { CheckinBoard } from "./checkin-board";
import { myChallengeProgress, SPIN_COLUMNS, type SpinRow } from "@/lib/wheel-server";
import { WeekChallengeCard } from "@/components/wheel/week-challenge-card";

export const metadata = { title: "Check-in" };

async function Content() {
  const ctx = await requireContext();
  const supabase = await createClient();
  const now = new Date();
  const today = todayKey(now, ctx.challenge.timezone);
  const phase = challengePhase(ctx.challenge, now);
  const dates = editableDates(ctx.challenge, now);
  const weekStart = weekStartOf(today);
  const rangeEnd = addDays(weekStart, 13);

  const [{ data: checkinRows }, { data: sourceRows }, { data: planRows }, { data: jokerRows }, { data: waterRows }, { data: habitRows }, { data: habitLogRows }, { data: sharingRow }, { data: stepRows }, { data: spinRow }] = await Promise.all([
    supabase.from("daily_checkins").select("checkin_date, activities").eq("challenge_id", ctx.challenge.id).eq("user_id", ctx.userId),
    supabase.from("checkin_sources").select("checkin_date, activity, source").eq("user_id", ctx.userId).in("checkin_date", dates),
    supabase.from("planned_trainings").select("plan_date, kind").eq("user_id", ctx.userId).gte("plan_date", weekStart).lte("plan_date", rangeEnd),
    supabase.from("alcohol_exceptions").select("exception_date").eq("user_id", ctx.userId).eq("challenge_id", ctx.challenge.id),
    supabase.from("water_entries").select("log_date, amount_ml").eq("user_id", ctx.userId).in("log_date", dates),
    supabase.from("custom_habits").select("id, name, emoji, sort_order").eq("user_id", ctx.userId).order("sort_order"),
    supabase.from("custom_habit_logs").select("habit_id, log_date").eq("user_id", ctx.userId).in("log_date", dates),
    supabase.from("stat_sharing").select("share_habits").eq("user_id", ctx.userId).maybeSingle(),
    supabase.from("step_logs").select("log_date, steps").eq("user_id", ctx.userId).gte("log_date", addDays(weekStart, -1)).lte("log_date", today),
    // An extra challenge from this week's Weekrad belongs to this week's check-in.
    supabase.from("wheel_spins").select(SPIN_COLUMNS).eq("user_id", ctx.userId).eq("week_start", weekStart).eq("category", "challenge").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const weekChallenge = (spinRow ?? null) as SpinRow | null;
  const checkins = (checkinRows ?? []) as { checkin_date: string; activities: ActivityKey[] }[];
  const stats = computeStreakStats(checkins.map((c) => c.checkin_date), today);

  if (phase === "before") {
    const d = daysUntilStart(ctx.challenge, now);
    return (
      <Page>
        <PageTitle title="Today I Showed Up." subtitle="Je dagelijkse punten en je trainingsweek." />
        <EmptyState icon={Snowflake} title={`De Winter Arc start over ${d} ${d === 1 ? "dag" : "dagen"}`} body="Vanaf de eerste dag vink je hier je punten af en plan je je trainingen." />
      </Page>
    );
  }
  if (phase === "after" || dates.length === 0) {
    return (
      <Page>
        <PageTitle title="Today I Showed Up." subtitle="De Winter Arc is afgerond." />
        <EmptyState
          icon={Sparkles}
          title="We showed up. We grew together."
          body={`Je hebt ${stats.total} ${stats.total === 1 ? "dag" : "dagen"} ingecheckt. Bekijk je Winter Arc Wrapped.`}
          action={
            <Link href="/wrapped">
              <Button>Naar Wrapped</Button>
            </Link>
          }
        />
      </Page>
    );
  }

  const water: Record<string, number> = {};
  for (const w of (waterRows ?? []) as { log_date: string; amount_ml: number }[]) water[w.log_date] = (water[w.log_date] ?? 0) + w.amount_ml;
  const auto: Record<string, Record<string, "workout" | "water">> = {};
  for (const s of (sourceRows ?? []) as { checkin_date: string; activity: string; source: string }[]) {
    if (s.source === "manual") continue;
    auto[s.checkin_date] = { ...(auto[s.checkin_date] ?? {}), [s.activity]: s.source as "workout" | "water" };
  }
  const jokers = ((jokerRows ?? []) as { exception_date: string }[]).map((j) => j.exception_date);
  const challengeProgress = weekChallenge ? await myChallengeProgress(ctx, weekChallenge) : null;
  const habitLogs: Record<string, string[]> = {};
  for (const l of (habitLogRows ?? []) as { habit_id: string; log_date: string }[]) habitLogs[l.habit_id] = [...(habitLogs[l.habit_id] ?? []), l.log_date];

  return (
    <Page className="space-y-5">
      <PageTitle title="Today I Showed Up." subtitle="Je dagelijkse punten en je trainingsweek." />
      {weekChallenge?.challenge_key ? (
        <WeekChallengeCard spinId={weekChallenge.id} challengeKey={weekChallenge.challenge_key} progress={challengeProgress} completed={Boolean(weekChallenge.challenge_completed_at)} />
      ) : null}
      <CheckinBoard
        today={today}
        dates={dates}
        checkins={checkins.filter((c) => c.checkin_date >= addDays(weekStart, -1))}
        auto={auto}
        water={water}
        planned={(planRows ?? []) as { plan_date: string; kind: "run" | "strength" }[]}
        jokers={jokers}
        maxJokers={MAX_ALCOHOL_EXCEPTIONS}
        weekStart={weekStart}
        streak={stats.current}
        challengeStart={ctx.challenge.start_date}
        challengeEnd={ctx.challenge.end_date}
        habits={(habitRows ?? []) as Habit[]}
        habitLogs={habitLogs}
        habitsShared={Boolean((sharingRow as { share_habits?: boolean } | null)?.share_habits)}
        steps={(stepRows ?? []) as { log_date: string; steps: number }[]}
      />
    </Page>
  );
}

export default function CheckinPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}
