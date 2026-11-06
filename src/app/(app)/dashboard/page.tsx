import { Suspense } from "react";
import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import { requireContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { addDays, challengeDay, challengeLengthDays, challengePhase, formatDateNl, todayKey } from "@/lib/dates";
import { computeStreakStats } from "@/lib/streaks";
import { WATER_GOAL_ML, MAX_ALCOHOL_EXCEPTIONS } from "@/lib/constants";
import { BONUS_KINDS, BONUS_LABELS, BONUS_POINTS, BONUS_RULES, DAILY_HABITS, WEEKLY_TARGETS, weekBonus, weekScore, weekStartOf } from "@/lib/checkin-plan";
import { loadBonusItems } from "@/lib/bonus";
import { consistency, daysOnWaterGoal, delta, heatmap, pointsByDate, trainingWeeks, waterDays, weekDays, weekScoreSeries, type CheckinRow } from "@/lib/dashboard";
import { formatDistance, formatDuration, formatKg, runningProgress, strengthRecords } from "@/lib/fitness";
import { loadSessions, loadStrengthHistory } from "@/lib/fitness/data";
import { habitWeek } from "@/lib/habits";
import { formatMl } from "@/lib/format";
import { Page } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/skeleton";
import { SectionTitle } from "@/components/ui/card";
import { ActivityRings, Columns, Heatmap, Stat, StackedColumns, Trend } from "@/components/dashboard/charts";
import { CHART } from "@/lib/chart-colors";

export const metadata = { title: "Performance" };

const short = (d: string) => formatDateNl(d, { day: "numeric", month: "short" }).replace(".", "");
const dayShort = (d: string) => formatDateNl(d, { weekday: "short" }).replace(".", "").slice(0, 2);

function Card({ children }: { children: React.ReactNode }) {
  return <div className="glass rounded-[22px] p-4">{children}</div>;
}

async function Content() {
  const ctx = await requireContext();
  const supabase = await createClient();
  const now = new Date();
  const today = todayKey(now, ctx.challenge.timezone);
  const start = weekStartOf(today);
  const lastWeekStart = addDays(start, -7);

  const [{ data: checkinRows }, { data: jokerRows }, { data: waterRows }, sessions, strength, { data: habitRows }, { data: habitLogRows }, { data: stepRows }, bonusItems] = await Promise.all([
    supabase.from("daily_checkins").select("checkin_date, activities").eq("user_id", ctx.userId).eq("challenge_id", ctx.challenge.id),
    supabase.from("alcohol_exceptions").select("exception_date").eq("user_id", ctx.userId).eq("challenge_id", ctx.challenge.id),
    supabase.from("water_entries").select("log_date, amount_ml").eq("user_id", ctx.userId).gte("log_date", addDays(today, -13)),
    loadSessions(ctx, { status: "completed" }),
    loadStrengthHistory(ctx),
    supabase.from("custom_habits").select("id, name, emoji").eq("user_id", ctx.userId).order("sort_order"),
    supabase.from("custom_habit_logs").select("habit_id, log_date").eq("user_id", ctx.userId).gte("log_date", start),
    supabase.from("step_logs").select("log_date, steps").eq("user_id", ctx.userId).eq("challenge_id", ctx.challenge.id),
    loadBonusItems(ctx.challenge.id, lastWeekStart, ctx.challenge.timezone, ctx.userId),
  ]);
  const steps = (stepRows ?? []) as { log_date: string; steps: number }[];

  const checkins = (checkinRows ?? []) as CheckinRow[];
  const jokers = ((jokerRows ?? []) as { exception_date: string }[]).map((j) => j.exception_date);
  const points = pointsByDate(checkins, jokers);
  const streak = computeStreakStats(checkins.map((c) => c.checkin_date), today);
  const thisWeek = weekScore(start, checkins.filter((c) => c.checkin_date >= start), jokers.filter((j) => j >= start), steps.filter((l) => l.log_date >= start), bonusItems);
  const bonusThisWeek = weekBonus(start, bonusItems).counts;
  const prevWeek = weekScore(
    lastWeekStart,
    checkins.filter((c) => c.checkin_date >= lastWeekStart && c.checkin_date < start),
    jokers.filter((j) => j >= lastWeekStart && j < start),
    steps.filter((l) => l.log_date >= lastWeekStart && l.log_date < start),
    bonusItems,
  );
  // Only Winter Arc weeks: a line through empty weeks before the start says nothing.
  const arcWeeks = Math.max(1, Math.min(8, Math.floor((Date.parse(start) - Date.parse(weekStartOf(ctx.challenge.start_date))) / (7 * 86400000)) + 1));
  const scores = weekScoreSeries(today, checkins, jokers, arcWeeks, steps);
  const days = weekDays(start, points);
  const phaseDay = challengePhase(ctx.challenge, now) === "during" ? challengeDay(ctx.challenge, now) : null;
  const consist = consistency(points, ctx.challenge.start_date, today < ctx.challenge.end_date ? today : ctx.challenge.end_date);

  const water = waterDays((waterRows ?? []) as { log_date: string; amount_ml: number }[], today, 14);
  const waterToday = water[water.length - 1].ml;
  const waterAvg = Math.round(water.slice(-7).reduce((a, d) => a + d.ml, 0) / 7);

  const weeks = trainingWeeks(sessions, today, 8);
  const now8 = weeks[weeks.length - 1];
  const prev8 = weeks[weeks.length - 2];
  const trainingsThisWeek = now8.run + now8.strength + now8.other;
  const trainingsLastWeek = prev8.run + prev8.strength + prev8.other;
  const targetDone = Math.min(now8.run, WEEKLY_TARGETS.run) + Math.min(now8.strength, WEEKLY_TARGETS.strength);
  const targetTotal = WEEKLY_TARGETS.run + WEEKLY_TARGETS.strength;
  const running = runningProgress(sessions);
  const records = strengthRecords(strength.rows).sort((a, b) => b.maxWeightKg - a.maxWeightKg).slice(0, 4);
  const totalMinutes = Math.round(sessions.reduce((a, s) => a + (s.duration_seconds ?? 0), 0) / 60);
  const totalRunKm = Math.round(running.runs.reduce((a, r) => a + r.meters, 0) / 100) / 10;

  const habits = (habitRows ?? []) as { id: string; name: string; emoji: string | null }[];
  const habitLogs = (habitLogRows ?? []) as { habit_id: string; log_date: string }[];

  return (
    <Page className="space-y-5">
      <div className="px-0.5">
        <h1 className="font-display text-[27px] leading-[1.15]">Performance</h1>
        <p className="mt-1 text-[13px] text-muted">
          {phaseDay ? `Dag ${phaseDay} van ${challengeLengthDays(ctx.challenge)} · ` : ""}week van {short(start)}
        </p>
      </div>

      {/* Hero: this week's score */}
      <section className="espresso rounded-[24px] p-5" aria-label="Deze week">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] opacity-70">Weekscore</p>
        <p className="mt-1 font-sans text-[52px] font-semibold leading-none tabular-nums">
          {Math.round(thisWeek.fraction * 100)}
          <span className="text-[22px] font-medium opacity-70">%</span>
        </p>
        <p className="mt-1.5 text-[12.5px] opacity-80">
          {thisWeek.earned} van {thisWeek.total} punten{thisWeek.bonus ? ` + ${thisWeek.bonus} bonus` : ""} · vorige week {Math.round(prevWeek.fraction * 100)}%
        </p>
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Bonus deze week">
          {BONUS_KINDS.map((k) => {
            const done = bonusThisWeek[k] > 0;
            return (
              <li key={k} className={done ? "flex items-center gap-1 on-tile rounded-full bg-white/90 px-2.5 py-1 text-[11.5px] font-medium" : "flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] opacity-75 ring-1 ring-white/30"}>
                {done ? <Check className="h-3 w-3" strokeWidth={2.4} aria-hidden /> : null}
                {BONUS_LABELS[k]} {done ? `+${bonusThisWeek[k] * BONUS_POINTS}` : BONUS_RULES[k]}
                <span className="sr-only">{done ? "(behaald)" : "(nog niet)"}</span>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/15 pt-3.5 text-center">
          <div>
            <p className="font-sans text-[20px] font-semibold tabular-nums">{streak.current}</p>
            <p className="text-[10.5px] opacity-70">streak</p>
          </div>
          <div>
            <p className="font-sans text-[20px] font-semibold tabular-nums">{streak.longest}</p>
            <p className="text-[10.5px] opacity-70">langste streak</p>
          </div>
          <div>
            <p className="font-sans text-[20px] font-semibold tabular-nums">{consist.pct}%</p>
            <p className="text-[10.5px] opacity-70">consistentie</p>
          </div>
        </div>
      </section>

      <section aria-label="Vandaag">
        <SectionTitle>Vandaag</SectionTitle>
        <Card>
          <ActivityRings
            rings={[
              { label: "Dagpunten", value: `${points.get(today) ?? 0} van ${DAILY_HABITS.length}`, fraction: (points.get(today) ?? 0) / DAILY_HABITS.length, color: CHART.green },
              { label: "Water", value: `${(waterToday / 1000).toLocaleString("nl-NL", { maximumFractionDigits: 1 })} van ${(WATER_GOAL_ML / 1000).toLocaleString("nl-NL")} l`, fraction: waterToday / WATER_GOAL_ML, color: CHART.blue },
              { label: "Training deze week", value: `${targetDone} van ${targetTotal}`, fraction: targetDone / targetTotal, color: CHART.orange },
            ]}
          />
        </Card>
      </section>

      <section aria-label="Deze week">
        <SectionTitle action={<Link href="/checkin" className="flex items-center text-[13px] text-muted">Check-in <ChevronRight className="h-3.5 w-3.5" /></Link>}>Dagpunten deze week</SectionTitle>
        <Card>
          <Columns data={days.map((d) => ({ key: d.date, label: dayShort(d.date), value: d.points, tip: `${formatDateNl(d.date, { weekday: "long" })}: ${d.points} van ${DAILY_HABITS.length}` }))} max={DAILY_HABITS.length} current={today} height={110} empty="Nog geen punten deze week" />
        </Card>
      </section>

      <section aria-label="Weekscore">
        <SectionTitle>Weekscore per week</SectionTitle>
        <Card>
          <Trend data={scores.map((w) => ({ key: w.start, label: short(w.start), value: Math.round(w.fraction * 100) }))} max={100} suffix="%" />
        </Card>
      </section>

      <section aria-label="Training">
        <SectionTitle action={<Link href="/fitness/progress" className="flex items-center text-[13px] text-muted">Progressie <ChevronRight className="h-3.5 w-3.5" /></Link>}>Training</SectionTitle>
        <div className="grid grid-cols-2 gap-2.5">
          <Stat label="Trainingen deze week" value={trainingsThisWeek} change={delta(trainingsThisWeek, trainingsLastWeek)} />
          <Stat label="Minuten deze week" value={now8.minutes} unit="min" change={delta(now8.minutes, prev8.minutes)} changeUnit=" min" />
          <Stat label="Hardlopen deze week" value={now8.runKm.toLocaleString("nl-NL")} unit="km" change={delta(now8.runKm, prev8.runKm)} changeUnit=" km" />
          <Stat label="Totaal Winter Arc" value={totalMinutes} unit="min" hint={`${sessions.length} trainingen · ${totalRunKm.toLocaleString("nl-NL")} km gelopen`} />
        </div>
        <div className="mt-2.5">
          <Card>
            <p className="mb-2 text-[12.5px] font-medium text-text">Trainingen per week</p>
            <StackedColumns
              unit="trainingen"
              series={[
                { key: "run", label: "Hardlopen", color: CHART.orange },
                { key: "strength", label: "Kracht", color: CHART.blue },
                { key: "other", label: "Overig", color: CHART.green },
              ]}
              data={weeks.map((w) => ({ key: w.start, label: short(w.start).split(" ")[0], values: { run: w.run, strength: w.strength, other: w.other } }))}
            />
          </Card>
        </div>
      </section>

      <section aria-label="Water">
        <SectionTitle action={<Link href="/water" className="flex items-center text-[13px] text-muted">Water <ChevronRight className="h-3.5 w-3.5" /></Link>}>Water, laatste 14 dagen</SectionTitle>
        <Card>
          <div className="mb-3 flex gap-6">
            <div>
              <p className="text-[11.5px] text-muted">Gemiddeld per dag</p>
              <p className="font-sans text-[20px] font-semibold tabular-nums text-text">{formatMl(waterAvg)}</p>
            </div>
            <div>
              <p className="text-[11.5px] text-muted">Dagen op doel</p>
              <p className="font-sans text-[20px] font-semibold tabular-nums text-text">{daysOnWaterGoal(water)} van 14</p>
            </div>
          </div>
          <Columns
            data={water.map((d) => ({ key: d.date, label: dayShort(d.date).charAt(0), value: d.ml, tip: `${short(d.date)}: ${formatMl(d.ml)}` }))}
            color={CHART.blue}
            goal={WATER_GOAL_ML}
            goalLabel="doel 2,5 l"
            current={today}
            empty="Nog geen water gelogd"
          />
        </Card>
      </section>

      <section aria-label="Kalender">
        <SectionTitle>Winter Arc kalender</SectionTitle>
        <Card>
          <Heatmap columns={heatmap(ctx.challenge.start_date, ctx.challenge.end_date, today, points)} today={today} />
          <p className="mt-2 text-[11.5px] text-muted">
            {consist.active} van {consist.days} dagen ingecheckt · jokers {jokers.length} van {MAX_ALCOHOL_EXCEPTIONS}
          </p>
        </Card>
      </section>

      {running.longestMeters > 0 || records.length > 0 ? (
        <section aria-label="Records">
          <SectionTitle>Records</SectionTitle>
          <Card>
            <ul className="divide-y divide-ink/[0.06]">
              {running.longestMeters > 0 ? (
                <li className="flex items-center justify-between py-2">
                  <span className="text-[13px] text-muted">Langste run</span>
                  <span className="text-[14px] font-semibold tabular-nums text-text">{formatDistance(running.longestMeters)}</span>
                </li>
              ) : null}
              {running.fastest5kSeconds ? (
                <li className="flex items-center justify-between py-2">
                  <span className="text-[13px] text-muted">Snelste 5 km</span>
                  <span className="text-[14px] font-semibold tabular-nums text-text">{formatDuration(Math.round(running.fastest5kSeconds))}</span>
                </li>
              ) : null}
              {records.map((r) => (
                <li key={r.exerciseId} className="flex items-center justify-between py-2">
                  <span className="truncate pr-3 text-[13px] text-muted">{r.name}</span>
                  <span className="text-[14px] font-semibold tabular-nums text-text">{formatKg(r.maxWeightKg)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      {habits.length > 0 ? (
        <section aria-label="Eigen gewoontes">
          <SectionTitle>Eigen gewoontes deze week</SectionTitle>
          <Card>
            <ul className="space-y-2.5">
              {habits.map((h) => {
                const week = habitWeek(habitLogs.filter((l) => l.habit_id === h.id).map((l) => l.log_date), start);
                const done = week.filter(Boolean).length;
                return (
                  <li key={h.id}>
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <span className="truncate text-[13px] text-text">
                        {h.emoji ? `${h.emoji} ` : ""}
                        {h.name}
                      </span>
                      <span className="shrink-0 text-[12px] tabular-nums text-muted">{done} van 7</span>
                    </div>
                    <div className="flex gap-[2px]" aria-hidden>
                      {week.map((on, i) => (
                        <span key={i} className="h-2 flex-1 rounded-full" style={{ background: on ? CHART.green : CHART.track }} />
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </section>
      ) : null}
    </Page>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}
