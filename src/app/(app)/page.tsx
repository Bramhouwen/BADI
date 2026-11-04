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
import { computeStreakStats } from "@/lib/streaks";
import { firstName } from "@/lib/utils";
import { Page } from "@/components/ui/page";
import { Card, SectionTitle } from "@/components/ui/card";
import { PageSkeleton } from "@/components/ui/skeleton";
import { HeroCard } from "@/components/home/hero-card";
import { WEEKLY_TARGETS, dailyScore, weekScore, weekStartOf, WEEKLY_STEPS_GOAL, WEEKLY_STEP_POINTS, stepPoints, stepsByDay } from "@/lib/checkin-plan";
import { AskField, BADDY_PHOTO } from "@/components/coach/baddy-ask";
import { Avatar } from "@/components/ui/avatar";
import { StepsSlide, TodayCarousel, TrainingSlide, WaterSlide, WeekSlide } from "@/components/home/today-slides";
import { trainingWeeks } from "@/lib/dashboard";
import { activityMeta } from "@/lib/fitness";
import { formatDateNl } from "@/lib/dates";
import { loadSessions } from "@/lib/fitness/data";
import { SquadPreview } from "@/components/home/squad-preview";
import { InspirationPreview } from "@/components/home/inspiration-preview";
import { RealtimeRefresher } from "@/components/app/realtime-refresher";
import { WelcomeToast } from "@/components/home/welcome-toast";
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

  const weekStart = weekStartOf(today);
  const [squad, { data: checkinRows }, { data: postRows }, { data: recipeRows }, { data: waterRows }, workouts, { data: jokerRow }, { data: weekJokerRows }, { data: weekStepRows }] = await Promise.all([
    getSquad(ctx.challenge.id),
    supabase.from("daily_checkins").select("user_id, checkin_date, activities, note, created_at").eq("challenge_id", ctx.challenge.id),
    supabase.from("wall_posts").select("id, user_id, image_path, caption, created_at").eq("challenge_id", ctx.challenge.id).order("created_at", { ascending: false }).limit(2),
    supabase.from("recipes").select("id, user_id, image_path, title, created_at").eq("challenge_id", ctx.challenge.id).order("created_at", { ascending: false }).limit(2),
    supabase.from("water_entries").select("amount_ml").eq("user_id", ctx.userId).eq("log_date", today),
    loadSessions(ctx, { status: "completed", limit: 60 }),
    supabase.from("alcohol_exceptions").select("id").eq("user_id", ctx.userId).eq("exception_date", today).maybeSingle(),
    supabase.from("alcohol_exceptions").select("user_id, exception_date").eq("challenge_id", ctx.challenge.id).gte("exception_date", weekStart),
    supabase.from("step_logs").select("user_id, log_date, steps").eq("challenge_id", ctx.challenge.id).gte("log_date", weekStart),
  ]);
  const weekSteps = (weekStepRows ?? []) as { user_id: string; log_date: string; steps: number }[];
  const weekJokers = (weekJokerRows ?? []) as { user_id: string; exception_date: string }[];
  const lastWorkout = workouts[0] ?? null;
  const waterTotal = ((waterRows ?? []) as Pick<WaterEntry, "amount_ml">[]).reduce((s, r) => s + r.amount_ml, 0);

  const checkins = (checkinRows ?? []) as Pick<DailyCheckin, "user_id" | "checkin_date" | "activities" | "note" | "created_at">[];
  const mine = checkins.filter((c) => c.user_id === ctx.userId);
  const myStats = computeStreakStats(
    mine.map((c) => c.checkin_date),
    today,
  );
  const todayCheckin = mine.find((c) => c.checkin_date === today) ?? null;

  const members = rotateMembers(squad, day).map((m) => {
    const theirs = checkins.filter((c) => c.user_id === m.user_id);
    const stats = computeStreakStats(
      theirs.map((c) => c.checkin_date),
      today,
    );
    const week = weekScore(
      weekStart,
      theirs.filter((c) => c.checkin_date >= weekStart),
      weekJokers.filter((j) => j.user_id === m.user_id).map((j) => j.exception_date),
      weekSteps.filter((s) => s.user_id === m.user_id),
    );
    return { ...m, stats, week, isMe: m.user_id === ctx.userId };
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
  const myWeek = members.find((m) => m.isMe)?.week ?? { fraction: 0, earned: 0, total: 48 };
  const mySteps = Object.values(stepsByDay(weekStart, weekSteps.filter((s) => s.user_id === ctx.userId), mine.filter((c) => c.checkin_date >= weekStart))).reduce((a, b) => a + b, 0);
  const thisTrainingWeek = trainingWeeks(workouts, today, 1)[0];

  return (
    <Page className="space-y-4"><div className="h-1" />
      <WelcomeToast />
      <RealtimeRefresher channel={`home:${ctx.challenge.id}`} tables={["daily_checkins", "wall_posts", "recipes"]} />

      <div className="flex items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <p className="font-display text-[19px] leading-none text-text/80">{greeting(now, ctx.challenge.timezone).replace("!", ",")}</p>
          <h1 className="mt-1 truncate font-display text-[36px] leading-[1.05] text-text">{firstName(ctx.profile.display_name)}</h1>
        </div>
        {phase === "during" ? (
          <span className="mb-1.5 shrink-0 rounded-full bg-white/70 px-3 py-1 shadow-sm ring-1 ring-ink/[0.05]">
            <span className="text-[12px] font-medium tabular-nums text-ink">
              Dag {day} · {finale === 0 ? "finale" : `nog ${finale}`}
            </span>
          </span>
        ) : null}
      </div>

      {phase === "during" ? (
        <TodayCarousel label="Vandaag">
          <HeroCard checkedIn={Boolean(todayCheckin)} activities={dailyScore(todayCheckin?.activities ?? [], Boolean(jokerRow)).done} note={todayCheckin?.note ?? null} canEdit={canEditToday} />
          <WeekSlide fraction={myWeek.fraction} earned={myWeek.earned} total={myWeek.total} streak={myStats.current} />
          <StepsSlide total={mySteps} goal={WEEKLY_STEPS_GOAL} points={stepPoints(mySteps)} maxPoints={WEEKLY_STEP_POINTS} />
          <WaterSlide total={waterTotal} goal={WATER_GOAL_ML} />
          <TrainingSlide run={thisTrainingWeek.run} strength={thisTrainingWeek.strength} runTarget={WEEKLY_TARGETS.run} strengthTarget={WEEKLY_TARGETS.strength} last={lastWorkout ? `${activityMeta(lastWorkout.activity_type).label}, ${formatDateNl(lastWorkout.workout_date, { weekday: "long", day: "numeric", month: "short" })}` : null} />
        </TodayCarousel>
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

      {wrapped !== "not_yet" && phase !== "after" ? (
        <Link href="/wrapped" className="block">
          <Card className="ring-1 ring-gold/50">
            <p className="text-[11px] font-medium tracking-[0.2em] text-muted">WINTER ARC WRAPPED</p>
            <p className="mt-1 font-semibold">{wrapped === "preliminary" ? "De finale is hier. Bekijk alvast jullie voorlopige Wrapped." : "Jullie Wrapped staat klaar."}</p>
          </Card>
        </Link>
      ) : null}

      <section aria-label="Vraag Baddy" className="flex items-center gap-2.5">
        <Link href="/coach" aria-label="Open je gesprek met Baddy" className="relative shrink-0">
          <Avatar name="Baddy" src={BADDY_PHOTO} size="md" className="h-11 w-11 ring-2 ring-sage/50" />
        </Link>
        <div className="min-w-0 flex-1">
          <AskField placeholder="Vraag Baddy iets" />
        </div>
      </section>

      <section>
        <SectionTitle action={<Link href="/squad" className="text-[13px] text-muted">Chats</Link>}>Jouw squad</SectionTitle>
        <SquadPreview members={members.map((m) => ({ id: m.user_id, name: m.profile.display_name, avatar: m.profile.avatar_path ? avatarUrls.get(m.profile.avatar_path) ?? null : null, streak: m.stats.current, lastDate: m.stats.lastDate, checkedInToday: m.stats.checkedInToday, isMe: m.isMe, week: m.week.fraction }))} today={today} />
      </section>

      <section>
        <SectionTitle action={<Link href="/wall" className="text-[13px] text-muted">The Wall</Link>}>Nieuw van de squad</SectionTitle>
        <InspirationPreview items={inspiration} />
      </section>
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
