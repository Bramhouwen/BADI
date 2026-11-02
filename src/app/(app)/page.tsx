import { Suspense } from "react";
import Link from "next/link";
import { getSquad, requireContext, rotateMembers } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { signedUrlMap } from "@/lib/storage";
import {
  challengeDay,
  challengePhase,
  daysUntilFinale,
  daysUntilStart,
  greeting,
  isEditableDate,
  todayKey,
  wrappedStatus,
} from "@/lib/dates";
import { computeStreakStats, recentCalendar } from "@/lib/streaks";
import { firstName } from "@/lib/utils";
import { Page } from "@/components/ui/page";
import { Card, SectionTitle } from "@/components/ui/card";
import { challengeLengthDays } from "@/lib/dates";
import { PageSkeleton } from "@/components/ui/skeleton";
import { WeekCard } from "@/components/home/streak-card";
import { HeroCard } from "@/components/home/hero-card";
import { FeatureCards, SquadRow } from "@/components/home/feature-cards";
import { BaddyCard } from "@/components/coach/ask-baddy";
import { ProgressCard } from "@/components/home/progress-card";
import { FitnessCard } from "@/components/home/fitness-card";
import { loadSessions } from "@/lib/fitness/data";
import { weekStats } from "@/lib/fitness";
import { SquadPreview } from "@/components/home/squad-preview";
import { InspirationPreview } from "@/components/home/inspiration-preview";
import { RealtimeRefresher } from "@/components/app/realtime-refresher";
import { WelcomeToast } from "@/components/home/welcome-toast";
import { WaterTracker } from "@/components/water/water-tracker";
import { WATER_GOAL_ML } from "@/lib/constants";
import type { WaterEntry } from "@/lib/types";
import type { DailyCheckin, Recipe, WallPost } from "@/lib/types";

async function Content() {
  const ctx = await requireContext();
  const supabase = await createClient();
  const now = new Date();
  const today = todayKey(now, ctx.challenge.timezone);
  const phase = challengePhase(ctx.challenge, now);
  const day = challengeDay(ctx.challenge, now);

  const [squad, { data: checkinRows }, { data: postRows }, { data: recipeRows }, { data: waterRows }, workouts] = await Promise.all([
    getSquad(ctx.challenge.id),
    supabase.from("daily_checkins").select("user_id, checkin_date, activities, note, created_at").eq("challenge_id", ctx.challenge.id),
    supabase.from("wall_posts").select("id, user_id, image_path, caption, created_at").eq("challenge_id", ctx.challenge.id).order("created_at", { ascending: false }).limit(2),
    supabase.from("recipes").select("id, user_id, image_path, title, created_at").eq("challenge_id", ctx.challenge.id).order("created_at", { ascending: false }).limit(2),
    supabase.from("water_entries").select("amount_ml").eq("user_id", ctx.userId).eq("log_date", today),
    loadSessions(ctx, { status: "completed", limit: 60 }),
  ]);
  const fitnessWeek = weekStats(workouts, today);
  const lastWorkout = workouts[0] ?? null;
  const waterTotal = ((waterRows ?? []) as Pick<WaterEntry, "amount_ml">[]).reduce((s, r) => s + r.amount_ml, 0);

  const checkins = (checkinRows ?? []) as Pick<DailyCheckin, "user_id" | "checkin_date" | "activities" | "note" | "created_at">[];
  const mine = checkins.filter((c) => c.user_id === ctx.userId);
  const myStats = computeStreakStats(
    mine.map((c) => c.checkin_date),
    today,
  );
  const calendar = recentCalendar(
    mine.map((c) => c.checkin_date),
    today,
    7,
    ctx.challenge,
  );
  const todayCheckin = mine.find((c) => c.checkin_date === today) ?? null;

  const members = rotateMembers(squad, day).map((m) => {
    const theirs = checkins.filter((c) => c.user_id === m.user_id);
    const stats = computeStreakStats(
      theirs.map((c) => c.checkin_date),
      today,
    );
    return { ...m, stats, isMe: m.user_id === ctx.userId };
  });

  const posts = (postRows ?? []) as Pick<WallPost, "id" | "user_id" | "image_path" | "caption" | "created_at">[];
  const recipes = (recipeRows ?? []) as Pick<Recipe, "id" | "user_id" | "image_path" | "title" | "created_at">[];
  const [wallUrls, recipeUrls, avatarUrls] = await Promise.all([
    signedUrlMap("wall", posts.map((p) => p.image_path)),
    signedUrlMap("recipes", recipes.map((r) => r.image_path).filter((p): p is string => Boolean(p))),
    signedUrlMap("avatars", squad.map((m) => m.profile.avatar_path).filter((p): p is string => Boolean(p))),
  ]);
  const nameOf = (id: string) => firstName(squad.find((m) => m.user_id === id)?.profile.display_name ?? "Iemand");
  const inspiration = [
    ...posts.map((p) => ({ kind: "post" as const, id: p.id, href: `/wall/${p.id}`, src: wallUrls.get(p.image_path) ?? null, title: p.caption || "Nieuw op de Wall", author: nameOf(p.user_id), created_at: p.created_at })),
    ...recipes.map((r) => ({ kind: "recipe" as const, id: r.id, href: `/kitchen/${r.id}`, src: r.image_path ? recipeUrls.get(r.image_path) ?? null : null, title: r.title, author: nameOf(r.user_id), created_at: r.created_at })),
  ]
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, 2);

  const wrapped = wrappedStatus(ctx.challenge, now);
  const finale = daysUntilFinale(ctx.challenge, now);
  const canEditToday = isEditableDate(ctx.challenge, today, now);

  return (
    <Page className="space-y-4"><div className="h-1" />
      <WelcomeToast />
      <RealtimeRefresher channel={`home:${ctx.challenge.id}`} tables={["daily_checkins", "wall_posts", "recipes"]} />

      <div className="px-1">
        <p className="font-display text-[19px] leading-none text-text/80">{greeting(now, ctx.challenge.timezone).replace("!", ",")}</p>
        <h1 className="mt-1 font-display text-[36px] leading-[1.05] text-text">{firstName(ctx.profile.display_name)}</h1>
      </div>

      {phase === "during" ? (
        <HeroCard checkedIn={Boolean(todayCheckin)} activities={todayCheckin?.activities.length ?? 0} note={todayCheckin?.note ?? null} canEdit={canEditToday} />
      ) : phase === "before" ? (
        <Card variant="dark" className="rounded-[24px] p-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">Binnenkort</p>
          <p className="mt-2 font-display text-[26px] italic leading-tight">De Winter Arc start over {daysUntilStart(ctx.challenge, now)} dagen.</p>
          <p className="mt-1 text-[13px] text-muted">Nodig je squad vast uit en bekijk de zeven principes.</p>
        </Card>
      ) : (
        <Card variant="dark" className="flex items-center justify-between gap-3 rounded-[24px] p-5">
          <div>
            <p className="font-display text-[24px] italic leading-tight">Jullie Winter Arc is afgerond.</p>
            <p className="mt-1 text-[13px] text-muted">Bekijk samen de Wrapped.</p>
          </div>
          <Link href="/wrapped" className="on-tile flex h-11 shrink-0 items-center rounded-full bg-paper px-4 text-[13px] font-medium">
            Wrapped
          </Link>
        </Card>
      )}

      <FeatureCards />
      <BaddyCard />

      <FitnessCard weekWorkouts={fitnessWeek.workouts} last={lastWorkout ? { title: lastWorkout.title, date: lastWorkout.workout_date, type: lastWorkout.activity_type } : null} />

      <SquadRow members={members.map((m) => ({ id: m.user_id, name: m.profile.display_name, avatar: m.profile.avatar_path ? avatarUrls.get(m.profile.avatar_path) ?? null : null, checkedInToday: m.stats.checkedInToday }))} />

      {wrapped !== "not_yet" && phase !== "after" ? (
        <Link href="/wrapped" className="block">
          <Card className="ring-1 ring-gold/50">
            <p className="text-[11px] font-medium tracking-[0.2em] text-muted">WINTER ARC WRAPPED</p>
            <p className="mt-1 font-semibold">{wrapped === "preliminary" ? "De finale is hier. Bekijk alvast jullie voorlopige Wrapped." : "Jullie Wrapped staat klaar."}</p>
          </Card>
        </Link>
      ) : null}

      <section className="space-y-3">
        <SectionTitle action={<Link href="/checkin" className="text-[13px] text-muted">Bekijk alles</Link>}>Voortgang</SectionTitle>
        <ProgressCard calendar={calendar} current={myStats.current} longest={myStats.longest} total={myStats.total} challengeLength={challengeLengthDays(ctx.challenge)} />
        <WeekCard calendar={calendar} />
        <WaterTracker total={waterTotal} goal={WATER_GOAL_ML} variant="compact" />
      </section>

      <section>
        <SectionTitle action={<Link href="/squad" className="text-[13px] text-muted">Bekijk squad</Link>}>Jouw squad</SectionTitle>
        <SquadPreview members={members.map((m) => ({ id: m.user_id, name: m.profile.display_name, avatar: m.profile.avatar_path ? avatarUrls.get(m.profile.avatar_path) ?? null : null, streak: m.stats.current, lastDate: m.stats.lastDate, checkedInToday: m.stats.checkedInToday, isMe: m.isMe }))} today={today} />
      </section>

      <section>
        <SectionTitle action={<Link href="/wall" className="text-[13px] text-muted">Bekijk meer</Link>}>Laatste inspiratie</SectionTitle>
        <InspirationPreview items={inspiration} />
      </section>

      <p className="text-center text-[13px] text-muted">
        {phase === "during"
          ? finale === 0
            ? "Vandaag is de Winter Arc finale"
            : `Nog ${finale} ${finale === 1 ? "dag" : "dagen"} tot de Winter Arc finale`
          : phase === "before"
            ? `De Winter Arc start op ${ctx.challenge.start_date.split("-").reverse().join("-")}`
            : "This was our Winter Arc."}
      </p>
    </Page>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}
