import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, Pencil, Snowflake } from "lucide-react";
import { IconBadge } from "@/components/ui/icon-badge";
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
import { formatDateNl } from "@/lib/dates";
import { challengeLengthDays } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/ui/skeleton";
import { StatTiles, WeekCard } from "@/components/home/streak-card";
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

  const [squad, { data: checkinRows }, { data: postRows }, { data: recipeRows }, { data: waterRows }] = await Promise.all([
    getSquad(ctx.challenge.id),
    supabase.from("daily_checkins").select("user_id, checkin_date, activities, note, created_at").eq("challenge_id", ctx.challenge.id),
    supabase.from("wall_posts").select("id, user_id, image_path, caption, created_at").eq("challenge_id", ctx.challenge.id).order("created_at", { ascending: false }).limit(2),
    supabase.from("recipes").select("id, user_id, image_path, title, created_at").eq("challenge_id", ctx.challenge.id).order("created_at", { ascending: false }).limit(2),
    supabase.from("water_entries").select("amount_ml").eq("user_id", ctx.userId).eq("log_date", today),
  ]);
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
    signedUrlMap("recipes", recipes.map((r) => r.image_path)),
    signedUrlMap("avatars", squad.map((m) => m.profile.avatar_path).filter((p): p is string => Boolean(p))),
  ]);
  const nameOf = (id: string) => firstName(squad.find((m) => m.user_id === id)?.profile.display_name ?? "Iemand");
  const inspiration = [
    ...posts.map((p) => ({ kind: "post" as const, id: p.id, href: `/wall/${p.id}`, src: wallUrls.get(p.image_path) ?? null, title: p.caption || "Nieuw op de Wall", author: nameOf(p.user_id), created_at: p.created_at })),
    ...recipes.map((r) => ({ kind: "recipe" as const, id: r.id, href: `/kitchen/${r.id}`, src: recipeUrls.get(r.image_path) ?? null, title: r.title, author: nameOf(r.user_id), created_at: r.created_at })),
  ]
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, 2);

  const wrapped = wrappedStatus(ctx.challenge, now);
  const finale = daysUntilFinale(ctx.challenge, now);
  const canEditToday = isEditableDate(ctx.challenge, today, now);

  return (
    <Page className="space-y-6">
      <WelcomeToast />
      <RealtimeRefresher channel={`home:${ctx.challenge.id}`} tables={["daily_checkins", "wall_posts", "recipes"]} />

      <div className="px-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">{formatDateNl(today, { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1 className="mt-1 font-display text-[32px] leading-[1.15] text-text">
          {greeting(now, ctx.challenge.timezone).replace("!", ",")} {firstName(ctx.profile.display_name)}
        </h1>
        <p className="mt-1.5 text-[14px] text-muted">Dag {day} van je Winter Arc. Goed dat je er bent.</p>
      </div>

      <section>
        <SectionTitle action={<Link href="/profile" className="text-[13px] text-muted">Bekijk meer</Link>}>Jouw cijfers</SectionTitle>
        <StatTiles current={myStats.current} longest={myStats.longest} total={myStats.total} challengeLength={challengeLengthDays(ctx.challenge)} />
        <div className="mt-3">
          <WeekCard calendar={calendar} />
        </div>
      </section>

      <section>
        <WaterTracker total={waterTotal} goal={WATER_GOAL_ML} variant="compact" />
      </section>

      {phase === "during" ? (
        todayCheckin ? (
          <Card className="flex items-center gap-4">
            <IconBadge icon={Snowflake} tone="sage" size="lg" className="rounded-full" />
            <div className="flex-1">
              <p className="text-[14px] font-medium leading-snug text-text">Je bent er vandaag weer voor gegaan. Lekker bezig!</p>
              <p className="mt-0.5 text-[12px] text-muted">{todayCheckin.note ? `“${todayCheckin.note}”` : `${todayCheckin.activities.length} ${todayCheckin.activities.length === 1 ? "activiteit" : "activiteiten"} gelogd`}</p>
            </div>
            {canEditToday ? (
              <Link href="/checkin" aria-label="Check-in aanpassen" className="soft flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
                <Pencil className="h-4 w-4" strokeWidth={1.6} />
              </Link>
            ) : null}
          </Card>
        ) : (
          <Card variant="dark" className="relative overflow-hidden rounded-[24px] p-5">
            <svg className="pointer-events-none absolute -right-6 -top-4 h-40 w-40 text-paper/15" viewBox="0 0 160 160" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
              <path d="M20 140 C 60 90, 90 70, 140 20" />
              <path d="M40 130 C 70 100, 95 85, 130 40" />
              <path d="M30 95 C 60 85, 80 70, 100 35" />
              <path d="M70 150 C 95 120, 115 105, 150 70" />
            </svg>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">Check-in van vandaag</p>
            <p className="mt-2 max-w-[260px] font-display text-[22px] leading-snug">Wat heb jij vandaag voor jezelf gedaan?</p>
            <p className="mt-1 text-[13px] text-muted">Eén activiteit is genoeg. Inchecken duurt tien seconden.</p>
            <Link href="/checkin" className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-paper px-5 text-[14px] font-medium text-ink">
              Check vandaag in <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
            </Link>
          </Card>
        )
      ) : phase === "before" ? (
        <Card variant="tile">
          <p className="font-semibold">De Winter Arc start over {daysUntilStart(ctx.challenge, now)} dagen.</p>
          <p className="mt-1 text-sm text-muted">Nodig je squad vast uit en bekijk de zeven principes.</p>
        </Card>
      ) : (
        <Card variant="tile" className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold">Jullie Winter Arc is afgerond.</p>
            <p className="mt-1 text-sm text-muted">Bekijk samen de Wrapped.</p>
          </div>
          <Link href="/wrapped">
            <Button size="sm">Wrapped</Button>
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
