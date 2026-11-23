import { Suspense } from "react";
import { INTERIM_WRAPPED_OPEN } from "@/lib/wrapped";
import Link from "next/link";
import { getSquad, requireContext, rotateMembers } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { signedUrlMap } from "@/lib/storage";
import {
  challengeDay,
  challengePhase,
  daysUntilFinale,
  daysUntilStart,
  addDays,
  greeting,
  hourInTz,
  isEditableDate,
  todayKey,
  wrappedStatus,
} from "@/lib/dates";
import { computeStreakStats } from "@/lib/streaks";
import { currentSuperBadi } from "@/lib/super-badi-server";
import { loadBonusItems } from "@/lib/bonus";
import { myChallengeProgress, SPIN_COLUMNS, type SpinRow } from "@/lib/wheel-server";
import { firstName } from "@/lib/utils";
import { Page } from "@/components/ui/page";
import { Card, SectionTitle } from "@/components/ui/card";
import { PageSkeleton } from "@/components/ui/skeleton";
import { HeroCard } from "@/components/home/hero-card";
import { WEEKLY_TARGETS, dailyScore, weekProgress, weekScore, weekStartOf, WEEKLY_STEPS_GOAL, WEEKLY_STEP_POINTS, stepPoints, stepsByDay } from "@/lib/checkin-plan";
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
import { WelcomeSplash } from "@/components/sprite/welcome-splash";
import { SPRITE_SHEETS, spriteFor } from "@/lib/sprites";
import { ANNOUNCEMENT, ANNOUNCEMENT_PREVIEW } from "@/lib/announcement";
import { announcementSent } from "@/lib/announcement-server";
import type { SplashItem } from "@/components/sprite/welcome-splash";
import { HomeBuddy } from "@/components/sprite/home-buddy";
import { welcomeMessage } from "@/lib/welcome";
import { CHALLENGE_META } from "@/lib/wheel";
import { WATER_GOAL_ML } from "@/lib/constants";
import type { WaterEntry } from "@/lib/types";
import type { DailyCheckin, Recipe, WallPost } from "@/lib/types";

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const ctx = await requireContext();
  const supabase = await createClient();
  const now = new Date();
  const today = todayKey(now, ctx.challenge.timezone);
  const phase = challengePhase(ctx.challenge, now);
  const day = challengeDay(ctx.challenge, now);

  const weekStart = weekStartOf(today);
  const [squad, { data: checkinRows }, { data: postRows }, { data: recipeRows }, { data: waterRows }, workouts, { data: jokerRow }, { data: weekJokerRows }, { data: weekStepRows }, bonusItems, { data: mySpinRow }] = await Promise.all([
    getSquad(ctx.challenge.id),
    supabase.from("daily_checkins").select("user_id, checkin_date, activities, note, created_at").eq("challenge_id", ctx.challenge.id),
    supabase.from("wall_posts").select("id, user_id, image_path, caption, created_at").eq("challenge_id", ctx.challenge.id).order("created_at", { ascending: false }).limit(2),
    supabase.from("recipes").select("id, user_id, image_path, title, created_at").eq("challenge_id", ctx.challenge.id).order("created_at", { ascending: false }).limit(2),
    supabase.from("water_entries").select("amount_ml").eq("user_id", ctx.userId).eq("log_date", today),
    loadSessions(ctx, { status: "completed", limit: 60 }),
    supabase.from("alcohol_exceptions").select("id").eq("user_id", ctx.userId).eq("exception_date", today).maybeSingle(),
    supabase.from("alcohol_exceptions").select("user_id, exception_date").eq("challenge_id", ctx.challenge.id).gte("exception_date", weekStart),
    supabase.from("step_logs").select("user_id, log_date, steps").eq("challenge_id", ctx.challenge.id).gte("log_date", weekStart),
    loadBonusItems(ctx.challenge.id, weekStart, ctx.challenge.timezone),
    supabase.from("wheel_spins").select(SPIN_COLUMNS).eq("user_id", ctx.userId).eq("week_start", weekStart).maybeSingle(),
  ]);
  const mySpin = (mySpinRow ?? null) as SpinRow | null;
  // An open week challenge: check it, so a completed one counts as bonus right away.
  const challengeProgress = mySpin?.category === "challenge" && !mySpin.challenge_completed_at ? await myChallengeProgress(ctx, mySpin) : null;
  if (challengeProgress?.complete) bonusItems.push({ user_id: ctx.userId, kind: "challenge", date: weekStart });
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
      bonusItems.filter((b) => b.user_id === m.user_id),
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
  // Super Badi: the winner of last week, all week long.
  const crowned = await currentSuperBadi(ctx);
  const myWeek = members.find((m) => m.isMe)?.week ?? { fraction: 0, earned: 0, bonus: 0, total: 48 };
  const mySteps = Object.values(stepsByDay(weekStart, weekSteps.filter((s) => s.user_id === ctx.userId), mine.filter((c) => c.checkin_date >= weekStart))).reduce((a, b) => a + b, 0);
  const thisTrainingWeek = trainingWeeks(workouts, today, 1)[0];

  // An announcement first (the admin can preview it with ?aankondiging=1), then your own character's daily hello.
  const announceSheet = SPRITE_SHEETS[ANNOUNCEMENT.sprite];
  const previewAnnouncement = ctx.membership.role === "admin" && sp[ANNOUNCEMENT_PREVIEW] === "1";
  const showAnnouncement = Boolean(announceSheet) && (previewAnnouncement || (await announcementSent(supabase, ctx.challenge.id)));

  // Your own character says hello once a day, with a line about your day.
  const mySprite = spriteFor(ctx.profile.display_name);
  const welcome = mySprite && phase === "during" ? await loadWelcome() : null;
  async function loadWelcome() {
    const [{ data: toMe }, { data: reads }] = await Promise.all([
      supabase.from("squad_messages").select("user_id, created_at, is_coach").eq("challenge_id", ctx.challenge.id).eq("recipient_id", ctx.userId).order("created_at", { ascending: false }).limit(50),
      supabase.from("direct_reads").select("peer_id, last_read_at").eq("user_id", ctx.userId),
    ]);
    const readAt = new Map(((reads ?? []) as { peer_id: string; last_read_at: string }[]).map((r) => [r.peer_id, r.last_read_at]));
    const unreadIds = [
      ...new Set(
        ((toMe ?? []) as { user_id: string; created_at: string; is_coach: boolean | null }[])
          .filter((m) => !m.is_coach && m.user_id !== ctx.userId && (!readAt.has(m.user_id) || m.created_at > readAt.get(m.user_id)!))
          .map((m) => m.user_id),
      ),
    ];
    const yesterday = mine.find((c) => c.checkin_date === addDays(today, -1));
    const training = weekProgress(weekStart, mine.filter((c) => c.checkin_date >= weekStart), []).totals;
    const openChallenge = mySpin?.category === "challenge" && mySpin.challenge_key && !mySpin.challenge_completed_at && !challengeProgress?.complete ? CHALLENGE_META[mySpin.challenge_key].title : null;
    return welcomeMessage({
      name: firstName(ctx.profile.display_name),
      userId: ctx.userId,
      date: today,
      hour: hourInTz(now, ctx.challenge.timezone),
      weekday: (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7,
      checkedInToday: Boolean(todayCheckin),
      yesterdayComplete: yesterday ? dailyScore(yesterday.activities).complete : false,
      streak: myStats.current,
      weekSteps: mySteps,
      stepsGoal: WEEKLY_STEPS_GOAL,
      run: { done: training.run.done, target: WEEKLY_TARGETS.run },
      strength: { done: training.strength.done, target: WEEKLY_TARGETS.strength },
      waterMl: waterTotal,
      waterGoalMl: WATER_GOAL_ML,
      superBadi: crowned.has(ctx.userId),
      canSpin: !mySpin,
      openChallenge,
      unreadFrom: unreadIds.map((id) => ({ id, name: nameOf(id) })),
      finaleIn: finale,
    });
  }

  return (
    <Page className="space-y-4"><div className="h-1" />
      <WelcomeToast />
      {(() => {
        const items: SplashItem[] = [];
        if (showAnnouncement && announceSheet) {
          items.push({
            storageKey: "badi:announce",
            value: ANNOUNCEMENT.id,
            force: previewAnnouncement,
            sheet: announceSheet,
            message: { greeting: ANNOUNCEMENT.greeting, line: ANNOUNCEMENT.line, anim: "wave", action: null },
          });
        }
        if (welcome && mySprite) items.push({ storageKey: "badi:welcome", value: `${ctx.userId}:${today}`, sheet: mySprite, message: welcome });
        return items.length ? <WelcomeSplash items={items} /> : null;
      })()}
      <RealtimeRefresher channel={`home:${ctx.challenge.id}`} tables={["daily_checkins", "wall_posts", "recipes"]} />

      <div className="flex items-end justify-between gap-3 px-1">
        <div className="min-w-0 flex-1">
          <p className="font-display text-[19px] leading-none text-text/80">{greeting(now, ctx.challenge.timezone).replace("!", ",")}</p>
          <h1 className="mt-1 truncate font-display text-[36px] leading-[1.05] text-text">{firstName(ctx.profile.display_name)}</h1>
        </div>
        {mySprite ? (
          <HomeBuddy
            sheet={mySprite}
            status={!todayCheckin ? "sleep" : dailyScore(todayCheckin.activities, Boolean(jokerRow)).complete ? "done" : "busy"}
            canTalk={Boolean(welcome)}
          />
        ) : null}
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
          <WeekSlide fraction={myWeek.fraction} earned={myWeek.earned} bonus={myWeek.bonus} total={myWeek.total} streak={myStats.current} />
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

      {INTERIM_WRAPPED_OPEN && wrapped === "not_yet" && phase === "during" ? (
        <Link href="/wrapped" className="block">
          <Card className="ring-1 ring-gold/50">
            <p className="text-[11px] font-medium tracking-[0.2em] text-muted">TUSSENSTAND</p>
            <p className="mt-1 font-semibold">Bekijk jullie Winter Arc tot nu toe.</p>
          </Card>
        </Link>
      ) : null}

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
        <SquadPreview members={members.map((m) => ({ id: m.user_id, name: m.profile.display_name, avatar: m.profile.avatar_path ? avatarUrls.get(m.profile.avatar_path) ?? null : null, streak: m.stats.current, lastDate: m.stats.lastDate, checkedInToday: m.stats.checkedInToday, isMe: m.isMe, week: m.week.fraction, superBadi: crowned.has(m.user_id) }))} today={today} />
      </section>

      <section>
        <SectionTitle action={<Link href="/wall" className="text-[13px] text-muted">The Wall</Link>}>Nieuw van de squad</SectionTitle>
        <InspirationPreview items={inspiration} />
      </section>
    </Page>
  );
}

export default function HomePage({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
