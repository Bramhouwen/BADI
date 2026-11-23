import { Suspense } from "react";
import { getSquad, requireContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { signedUrlMap } from "@/lib/storage";
import { addDays, daysUntilFinale, formatDateNl, todayKey, wrappedStatus } from "@/lib/dates";
import { computeWrapped, crownCounts, seasonStats, wheelSummary } from "@/lib/wrapped";
import { loadBonusItems } from "@/lib/bonus";
import { weekStartOf } from "@/lib/checkin-plan";
import { Page, PageTitle } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Gift } from "lucide-react";
import { WrappedView } from "./wrapped-view";
import type { Compliment, DailyCheckin, Recipe, WallPost } from "@/lib/types";
import { isDemo } from "@/lib/demo";

export const metadata = { title: "Wrapped" };

async function Content({ searchParams }: { searchParams: Promise<{ preview?: string | string[] }> }) {
  const sp = await searchParams;
  const ctx = await requireContext();
  const now = new Date();
  // Demo mode only: /wrapped?preview=1 shows the Wrapped layout before the finale.
  const status = isDemo() && sp.preview === "1" ? "preliminary" : wrappedStatus(ctx.challenge, now);

  if (status === "not_yet") {
    const d = daysUntilFinale(ctx.challenge, now);
    return (
      <Page>
        <PageTitle title="Winter Arc Wrapped" back="/profile" />
        <EmptyState
          icon={Gift}
          title={`Nog ${d} ${d === 1 ? "dag" : "dagen"} tot de finale`}
          body={`Op ${formatDateNl(ctx.challenge.end_date)} verschijnt hier jullie voorlopige Wrapped. De definitieve versie volgt zodra de laatste check-in is afgerond.`}
          action={
            isDemo() ? (
              <Link href="/wrapped?preview=1">
                <Button variant="secondary">Demo: bekijk de Wrapped alvast</Button>
              </Link>
            ) : undefined
          }
        />
      </Page>
    );
  }

  const supabase = await createClient();
  const { start_date: start, end_date: end } = ctx.challenge;
  const until = status === "final" ? end : todayKey(now, ctx.challenge.timezone);
  const [
    { data: jokerRows },
    { data: stepRows },
    { data: workoutRows },
    waterMl,
    { data: spinRows },
    { data: awardRows },
    bonusItems,
  ] = await Promise.all([
    supabase.from("alcohol_exceptions").select("exception_date").eq("challenge_id", ctx.challenge.id).eq("user_id", ctx.userId),
    supabase.from("step_logs").select("log_date, steps").eq("challenge_id", ctx.challenge.id).eq("user_id", ctx.userId),
    supabase.from("workout_sessions").select("activity_type, distance_meters").eq("user_id", ctx.userId).eq("status", "completed").gte("workout_date", start).lte("workout_date", end),
    sumWater(supabase, ctx.challenge.id, ctx.userId),
    supabase.from("wheel_spins").select("user_id, category, prize_brand, prize_name, challenge_completed_at").eq("challenge_id", ctx.challenge.id),
    supabase.from("super_badi_awards").select("user_ids").eq("challenge_id", ctx.challenge.id),
    loadBonusItems(ctx.challenge.id, weekStartOf(start), ctx.challenge.timezone, ctx.userId),
  ]);
  const [squad, { data: checkinRows }, { data: postRows }, { data: recipeRows }, { data: complimentRows }] = await Promise.all([
    getSquad(ctx.challenge.id),
    supabase.from("daily_checkins").select("user_id, checkin_date, activities").eq("challenge_id", ctx.challenge.id),
    supabase.from("wall_posts").select("id, user_id, image_path, caption, created_at").eq("challenge_id", ctx.challenge.id).order("created_at", { ascending: false }),
    supabase.from("recipes").select("user_id").eq("challenge_id", ctx.challenge.id),
    supabase.from("compliments").select("sender_id, receiver_id").eq("challenge_id", ctx.challenge.id),
  ]);
  // Compliments are only readable by sender and receiver. The group total comes
  // from a SECURITY DEFINER function that never exposes who received what.
  const { data: groupComplimentCount } = await supabase.rpc("group_compliment_count");

  const posts = (postRows ?? []) as Pick<WallPost, "id" | "user_id" | "image_path" | "caption" | "created_at">[];
  const checkins = (checkinRows ?? []) as Pick<DailyCheckin, "user_id" | "checkin_date" | "activities">[];
  const result = computeWrapped({
    members: squad.map((m) => ({ id: m.user_id, display_name: m.profile.display_name, avatar_path: m.profile.avatar_path })),
    checkins,
    posts,
    recipes: (recipeRows ?? []) as Pick<Recipe, "user_id">[],
    compliments: (complimentRows ?? []) as Pick<Compliment, "sender_id" | "receiver_id">[],
    challenge: ctx.challenge,
    today: status === "final" ? addDays(ctx.challenge.end_date, 1) : todayKey(now, ctx.challenge.timezone),
  });
  result.group.totalCompliments = typeof groupComplimentCount === "number" ? groupComplimentCount : result.group.totalCompliments;

  const season = seasonStats({
    challenge: ctx.challenge,
    until,
    checkins: checkins.filter((c) => c.user_id === ctx.userId),
    jokers: ((jokerRows ?? []) as { exception_date: string }[]).map((j) => j.exception_date),
    steps: (stepRows ?? []) as { log_date: string; steps: number }[],
    bonus: bonusItems,
  });
  const workouts = (workoutRows ?? []) as { activity_type: string; distance_meters: number | null }[];
  const runMeters = workouts.filter((w) => w.activity_type === "run").reduce((m, w) => m + (w.distance_meters ?? 0), 0);
  const crowns = crownCounts((awardRows ?? []) as { user_ids: string[] }[]);
  const wheel = wheelSummary((spinRows ?? []) as Parameters<typeof wheelSummary>[0]);
  const mine = wheel.get(ctx.userId) ?? { prizes: [], challengesDone: 0 };

  const [memoryUrls, avatarUrls] = await Promise.all([
    signedUrlMap("wall", result.memories.map((m) => m.image_path)),
    signedUrlMap("avatars", squad.map((m) => m.profile.avatar_path).filter((p): p is string => Boolean(p))),
  ]);

  return (
    <WrappedView
      status={status}
      challengeName={ctx.challenge.name}
      meId={ctx.userId}
      group={{
        ...result.group,
        prizesWon: [...wheel.values()].reduce((n, w) => n + w.prizes.length, 0),
        challengesDone: [...wheel.values()].reduce((n, w) => n + w.challengesDone, 0),
        crownWeeks: (awardRows ?? []).length,
      }}
      season={{
        ...season,
        workouts: workouts.length,
        runKm: Math.round(runMeters / 100) / 10,
        waterLiters: Math.round(waterMl / 100) / 10,
        crowns: crowns.get(ctx.userId) ?? 0,
        prizes: mine.prizes,
        challengesDone: mine.challengesDone,
      }}
      personal={result.personal.map((p) => ({
        ...p,
        // Only your own compliment counts leave the server; nobody sees a ranking.
        complimentsReceived: p.member.id === ctx.userId ? p.complimentsReceived : 0,
        complimentsSent: p.member.id === ctx.userId ? p.complimentsSent : 0,
        avatarUrl: p.member.avatar_path ? avatarUrls.get(p.member.avatar_path) ?? null : null,
        crowns: crowns.get(p.member.id) ?? 0,
      }))}
      memories={result.memories.map((m) => ({ id: m.id, url: memoryUrls.get(m.image_path) ?? null, caption: m.caption }))}
    />
  );
}

/** Your water over the challenge in ml, read in pages: a busy drinker logs more rows than one request returns. */
async function sumWater(supabase: Awaited<ReturnType<typeof createClient>>, challengeId: string, userId: string): Promise<number> {
  const PAGE = 1000;
  let total = 0;
  for (let from = 0; ; from += PAGE) {
    const { data } = await supabase.from("water_entries").select("amount_ml").eq("challenge_id", challengeId).eq("user_id", userId).order("id").range(from, from + PAGE - 1);
    const rows = (data ?? []) as { amount_ml: number }[];
    total += rows.reduce((n, r) => n + r.amount_ml, 0);
    if (rows.length < PAGE) return total;
  }
}

export default function WrappedPage({ searchParams }: PageProps<"/wrapped">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
