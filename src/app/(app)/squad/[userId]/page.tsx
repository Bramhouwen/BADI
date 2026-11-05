import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock, MessageCircle, Settings2 } from "lucide-react";
import { getSquad, requireContext } from "@/lib/data";
import { loadMemberHabits, loadMemberStats } from "@/lib/squad/data";
import { habitWeek } from "@/lib/habits";
import { weekStartOf } from "@/lib/checkin-plan";
import { signedUrl } from "@/lib/storage";
import { addDays, formatDateNl, todayKey, weekdayShortNl } from "@/lib/dates";
import { activityMeta, formatDistance, formatDuration, formatKg, formatPace, paceSecPerKm } from "@/lib/fitness";
import { activityStatus, compareRows, deriveMemberStats, gridDays, type MemberStats } from "@/lib/squad-stats";
import { firstName } from "@/lib/utils";
import { WATER_GOAL_ML } from "@/lib/constants";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { OnlineLine } from "@/components/ui/online-line";
import { createClient } from "@/lib/supabase/server";
import { WEEKLY_STEPS_GOAL, stepsByDay, weekScore } from "@/lib/checkin-plan";
import { Page, PageTitle } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/skeleton";
import { SectionTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { IconBadge } from "@/components/ui/icon-badge";
import { ActivityGrid } from "./activity-grid";
import { ComplimentButton } from "./compliment-button";

export const metadata = { title: "Squad-profiel" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Tile({ value, label, unit }: { value: string | number; label: string; unit?: string }) {
  return (
    <div className="glass rounded-[18px] px-3.5 py-3">
      <p className="font-display text-[24px] leading-none text-text">
        {value}
        {unit ? <span className="font-sans text-[12px] text-muted"> {unit}</span> : null}
      </p>
      <p className="mt-1 text-[11px] text-muted">{label}</p>
    </div>
  );
}

function Tiles({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2.5">{children}</div>;
}

async function Content({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  if (!UUID.test(userId)) notFound();
  const ctx = await requireContext();
  const squad = await getSquad(ctx.challenge.id);
  const member = squad.find((m) => m.user_id === userId);
  if (!member) notFound();

  const isMe = userId === ctx.userId;
  const today = todayKey(new Date(), ctx.challenge.timezone);
  const weekStart = weekStartOf(today);
  const supabase = await createClient();
  const [payload, minePayload, avatar, habits, { data: weekRows }, { data: weekJokers }, { data: weekSteps }, { data: waterShared }, { data: waterRows }] = await Promise.all([
    loadMemberStats(userId),
    isMe ? null : loadMemberStats(ctx.userId),
    signedUrl("avatars", member.profile.avatar_path),
    loadMemberHabits(userId, weekStart, addDays(weekStart, 6)),
    // RLS only returns check-ins of members who share them.
    supabase.from("daily_checkins").select("checkin_date, activities").eq("user_id", userId).gte("checkin_date", weekStart),
    supabase.from("alcohol_exceptions").select("exception_date").eq("user_id", userId).gte("exception_date", weekStart),
    supabase.from("step_logs").select("log_date, steps").eq("user_id", userId).gte("log_date", weekStart),
    isMe ? Promise.resolve({ data: true }) : supabase.rpc("shares_stat", { p_user: userId, p_key: "water" }),
    // RLS only returns water of members who share it.
    supabase.from("water_entries").select("log_date, amount_ml").eq("user_id", userId).gte("log_date", weekStart),
  ]);
  if (!payload) notFound();

  const stats = deriveMemberStats(payload, today, ctx.challenge);
  const mine: MemberStats | null = minePayload ? deriveMemberStats(minePayload, today, ctx.challenge) : null;
  const name = firstName(member.profile.display_name);
  const status = activityStatus(stats, today);
  const showHabits = habits.shared && habits.habits.length > 0;
  const week = stats.checkin
    ? weekScore(weekStart, (weekRows ?? []) as { checkin_date: string; activities: string[] }[], ((weekJokers ?? []) as { exception_date: string }[]).map((j) => j.exception_date), (weekSteps ?? []) as { log_date: string; steps: number }[])
    : null;
  // Steps are shared together with the check-ins.
  const weekStepsTotal = stats.checkin
    ? Object.values(stepsByDay(weekStart, (weekSteps ?? []) as { log_date: string; steps: number }[], (weekRows ?? []) as { checkin_date: string; activities: string[] }[])).reduce((a, b) => a + b, 0)
    : null;
  const liters = (ml: number) => `${new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 1 }).format(ml / 1000)} l`;
  // Water: today and the average per day so far this week.
  const water = waterShared
    ? (() => {
        const rows = (waterRows ?? []) as { log_date: string; amount_ml: number }[];
        const days = Math.max(1, Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${weekStart}T12:00:00Z`)) / 86_400_000) + 1);
        const total = rows.reduce((n, r) => n + r.amount_ml, 0);
        return { today: rows.filter((r) => r.log_date === today).reduce((n, r) => n + r.amount_ml, 0), average: Math.round(total / days) };
      })()
    : null;
  const sharesAnything = Object.values(stats.sharing).some(Boolean) || showHabits || Boolean(water);
  const showGrid = Boolean(stats.activeDays) || Boolean(stats.checkin);
  const grids = showGrid ? { week: gridDays(stats, today, "week"), "prev-week": gridDays(stats, today, "prev-week"), month: gridDays(stats, today, "month") } : null;
  const rows = mine ? compareRows(mine, stats) : [];
  const records = stats.records;
  const hasRecords = Boolean(records && (records.longest_run_meters || records.fastest_5k_seconds || records.strength.length));

  return (
    <Page className="space-y-6">
      <PageTitle
        title={isMe ? "Mijn profiel" : name}
        back="/squad"
        action={
          isMe ? (
            <Link href="/profile#zichtbaarheid" className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-ink shadow-sm hover:bg-blush" aria-label="Mijn Squad zichtbaarheid">
              <Settings2 className="h-[18px] w-[18px]" strokeWidth={1.6} />
            </Link>
          ) : undefined
        }
      />

      <section className="glass flex items-center gap-4 rounded-[22px] p-4" aria-label="Lid">
        <MemberAvatar userId={userId} name={member.profile.display_name} src={avatar} size={68} progress={week?.fraction ?? null} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[22px] leading-tight text-text">{member.profile.display_name}</p>
          <p className="mt-0.5 text-[12px] text-muted">
            {member.role === "admin" ? "Beheerder · " : ""}
            Lid sinds {formatDateNl(member.joined_at.slice(0, 10), { day: "numeric", month: "short" })}
          </p>
          <p className="mt-1 text-[12.5px] text-ink/80">{status ?? (isMe ? "Nog geen activiteit" : "Nog geen gedeelde activiteit")}</p>
          <OnlineLine userId={userId} week={week ? `${week.earned} van ${week.total} weekpunten` : null} />
        </div>
      </section>

      {!isMe ? (
        <div className="grid grid-cols-2 gap-2.5">
          <Link href={`/squad/chat/${userId}`} className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-ink/10 bg-white text-[14px] font-medium text-ink shadow-sm hover:bg-blush">
            <MessageCircle className="h-4 w-4" strokeWidth={1.7} /> Bericht
          </Link>
          <ComplimentButton receiver={{ id: userId, name }} />
        </div>
      ) : null}

      {isMe ? (
        <p className="flex items-start gap-2 px-0.5 text-[12px] leading-snug text-muted">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.7} />
          <span>
            Dit is je volledige overzicht. Squadleden zien alleen wat je deelt via{" "}
            <Link href="/profile#zichtbaarheid" className="font-medium text-ink underline underline-offset-2">
              Mijn Squad zichtbaarheid
            </Link>
            .
          </span>
        </p>
      ) : null}

      {!sharesAnything ? (
        <EmptyState icon={Lock} title="Nog niets gedeeld" body={`${name} deelt op dit moment geen statistieken met de squad.`} />
      ) : null}

      {stats.workouts || stats.effort || stats.activeDays || hasRecords ? (
        <section>
          <SectionTitle>Fitness</SectionTitle>
          <Tiles>
            {stats.workouts ? <Tile value={stats.workouts.week} label="trainingen deze week" /> : null}
            {stats.workouts ? <Tile value={stats.workouts.month} label="trainingen deze maand" /> : null}
            {stats.effort ? <Tile value={stats.effort.minutesTotal} unit="min" label="trainingsminuten totaal" /> : null}
            {stats.effort ? <Tile value={stats.effort.distanceMonthMeters > 0 ? formatDistance(stats.effort.distanceMonthMeters) : "0 km"} label="gelopen en gewandeld deze maand" /> : null}
            {stats.activeDays ? <Tile value={stats.activeDays.month} label="actieve dagen deze maand" /> : null}
            {stats.activeDays ? <Tile value={stats.activeDays.total} label="actieve dagen totaal" /> : null}
          </Tiles>
          {hasRecords && records ? (
            <div className="glass mt-2.5 rounded-[18px] px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Persoonlijke records</p>
              <ul className="mt-2 divide-y divide-ink/[0.06] text-[13px]">
                {records.fastest_5k_seconds ? (
                  <li className="flex items-center justify-between py-1.5">
                    <span className="text-muted">Snelste 5 km</span>
                    <span className="tabular-nums text-text">
                      {formatDuration(records.fastest_5k_seconds)} · {formatPace(paceSecPerKm(5000, records.fastest_5k_seconds))}
                    </span>
                  </li>
                ) : null}
                {records.longest_run_meters ? (
                  <li className="flex items-center justify-between py-1.5">
                    <span className="text-muted">Langste loop</span>
                    <span className="tabular-nums text-text">{formatDistance(records.longest_run_meters)}</span>
                  </li>
                ) : null}
                {records.strength.map((r) => (
                  <li key={r.exercise} className="flex items-center justify-between py-1.5">
                    <span className="truncate pr-3 text-muted">{r.exercise}</span>
                    <span className="tabular-nums text-text">{formatKg(r.max_weight_kg)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {stats.checkin ? (
        <section>
          <SectionTitle>Check-in</SectionTitle>
          <Tiles>
            <Tile value={stats.checkin.total} label={`check-ins van ${stats.checkin.daysElapsed} dagen`} />
            <Tile value={`${stats.checkin.consistencyPct}%`} label="consistentie" />
            <Tile value={stats.checkin.current} unit={stats.checkin.current === 1 ? "dag" : "dagen"} label="huidige streak" />
            <Tile value={stats.checkin.longest} unit={stats.checkin.longest === 1 ? "dag" : "dagen"} label="langste streak" />
            {weekStepsTotal !== null ? <Tile value={new Intl.NumberFormat("nl-NL").format(weekStepsTotal)} label={`stappen deze week, doel ${new Intl.NumberFormat("nl-NL").format(WEEKLY_STEPS_GOAL)}`} /> : null}
          </Tiles>
        </section>
      ) : null}

      {water ? (
        <section>
          <SectionTitle>Water</SectionTitle>
          <Tiles>
            <Tile value={liters(water.today)} label={`vandaag, doel ${liters(WATER_GOAL_ML)}`} />
            <Tile value={liters(water.average)} label="gemiddeld per dag deze week" />
          </Tiles>
        </section>
      ) : null}

      {grids ? (
        <section>
          <SectionTitle>Activiteit</SectionTitle>
          <ActivityGrid grids={grids} showWorkouts={Boolean(stats.activeDays)} showCheckins={Boolean(stats.checkin)} />
        </section>
      ) : null}

      {showHabits ? (
        <section>
          <SectionTitle>Eigen gewoontes</SectionTitle>
          <div className="glass rounded-[18px] px-4 py-3">
            <div className="grid grid-cols-[1fr_repeat(7,18px)] items-center gap-x-1.5 text-[10px] font-medium uppercase text-muted">
              <span>Deze week</span>
              {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((d) => (
                <span key={d} className={d === today ? "text-center text-ink" : "text-center"}>
                  {weekdayShortNl(d).slice(0, 2)}
                </span>
              ))}
            </div>
            <ul className="mt-1.5 space-y-1.5">
              {habits.habits.map((h) => (
                <li key={h.id} className="grid grid-cols-[1fr_repeat(7,18px)] items-center gap-x-1.5">
                  <span className="truncate text-[13px] text-text">
                    {h.emoji ? `${h.emoji} ` : ""}
                    {h.name}
                  </span>
                  {habitWeek(h.dates, weekStart).map((on, i) => (
                    <span key={i} className={on ? "mx-auto h-3.5 w-3.5 rounded-full bg-sage" : "mx-auto h-3.5 w-3.5 rounded-full bg-ink/10"} aria-label={on ? "afgevinkt" : "niet afgevinkt"} />
                  ))}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {stats.sharing.recent_workouts ? (
        <section>
          <SectionTitle>Recente trainingen</SectionTitle>
          {stats.recent.length === 0 ? (
            <p className="glass rounded-[18px] px-4 py-3.5 text-[13px] text-muted">Nog geen trainingen vastgelegd.</p>
          ) : (
            <ul className="space-y-2">
              {stats.recent.map((s, i) => {
                const meta = activityMeta(s.activity_type);
                const parts: string[] = [];
                if (s.duration_seconds) parts.push(formatDuration(s.duration_seconds));
                if (s.distance_meters) parts.push(formatDistance(s.distance_meters));
                return (
                  <li key={`${s.workout_date}-${i}`} className="glass flex items-center gap-3 rounded-[18px] py-2.5 pl-2.5 pr-4">
                    <IconBadge icon={meta.icon} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-medium text-text">{meta.label}</span>
                      <span className="block text-[11.5px] text-muted">{formatDateNl(s.workout_date, { weekday: "short", day: "numeric", month: "short" })}</span>
                    </span>
                    {parts.length ? <span className="shrink-0 text-[12.5px] tabular-nums text-ink/80">{parts.join(" · ")}</span> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      {mine && rows.length > 0 ? (
        <section>
          <SectionTitle>Naast elkaar</SectionTitle>
          <div className="glass rounded-[18px] px-4 py-3">
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
              <span />
              <span className="text-right">Jij</span>
              <span className="text-right">{name}</span>
            </div>
            <ul className="mt-1 divide-y divide-ink/[0.06]">
              {rows.map((r) => (
                <li key={r.key} className="grid grid-cols-[1fr_auto_auto] gap-x-4 py-2 text-[13px]">
                  <span className="text-muted">{r.label}</span>
                  <span className="text-right tabular-nums text-text">{r.mine}</span>
                  <span className="text-right tabular-nums text-text">{r.theirs}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-muted">Alleen wat {name} deelt. Geen ranking.</p>
          </div>
        </section>
      ) : null}

      {!isMe && sharesAnything ? (
        <p className="px-0.5 text-center text-[11px] text-muted">{name} bepaalt zelf welke statistieken zichtbaar zijn.</p>
      ) : null}
    </Page>
  );
}

export default function MemberPage({ params }: { params: Promise<{ userId: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content params={params} />
    </Suspense>
  );
}
