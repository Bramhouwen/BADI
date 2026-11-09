"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Check, ChevronRight, Flame } from "lucide-react";
import { ACTIVITIES, WATER_GOAL_ML, type ActivityKey } from "@/lib/constants";
import { ACTIVITY_ICONS } from "@/lib/activity-icons";
import { DAILY_HABITS, TRAINING_KINDS, WEEKLY_TARGETS, dailyScore, weekProgress, type TrainingKind } from "@/lib/checkin-plan";
import { addDays, formatDateNl, weekdayShortNl } from "@/lib/dates";
import { formatMl } from "@/lib/format";
import { spendJoker, toggleActivity, togglePlan, undoJoker } from "@/app/actions/checkins";
import { Ring } from "@/components/ui/ring";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { Habit } from "@/lib/habits";
import { MyHabits } from "./my-habits";
import { StepsCard } from "./steps-card";

interface Props {
  today: string;
  dates: string[];
  checkins: { checkin_date: string; activities: ActivityKey[] }[];
  auto: Record<string, Record<string, "workout" | "water">>;
  water: Record<string, number>;
  planned: { plan_date: string; kind: TrainingKind }[];
  jokers: string[];
  maxJokers: number;
  weekStart: string;
  streak: number;
  challengeStart: string;
  challengeEnd: string;
  habits: Habit[];
  habitLogs: Record<string, string[]>;
  habitsShared: boolean;
  steps: { log_date: string; steps: number }[];
}

const meta = (key: ActivityKey) => ACTIVITIES.find((a) => a.key === key)!;
const TRAINING_LABEL: Record<TrainingKind, string> = { run: "Hardlopen", strength: "Kracht" };

export function CheckinBoard(props: Props) {
  const { today, dates, auto, water, maxJokers, weekStart, challengeStart, challengeEnd } = props;
  const [date, setDate] = useState(dates[0]);
  const [acts, setActs] = useState<Record<string, ActivityKey[]>>(() => Object.fromEntries(props.checkins.map((c) => [c.checkin_date, c.activities])));
  const [planned, setPlanned] = useState(props.planned);
  const [jokers, setJokers] = useState(props.jokers);
  const [streak, setStreak] = useState(props.streak);
  const [week, setWeek] = useState<"this" | "next">("this");
  const [confirmJoker, setConfirmJoker] = useState(false);
  const [, start] = useTransition();
  const toast = useToast();

  const current = acts[date] ?? [];
  const joker = jokers.includes(date);
  const score = dailyScore(current, joker);
  const jokersLeft = Math.max(0, maxJokers - jokers.length);

  function toggle(key: ActivityKey, day: string = date): boolean {
    const on = !(acts[day] ?? []).includes(key);
    if (!on && auto[day]?.[key]) {
      toast(auto[day][key] === "water" ? "Dit staat aan via je water. Pas je water aan om het te wijzigen." : "Dit staat aan via een training in Fitness. Verwijder die training om dit uit te zetten.", "default");
      return false;
    }
    const before = acts;
    setActs((a) => ({ ...a, [day]: on ? [...(a[day] ?? []), key] : (a[day] ?? []).filter((k) => k !== key) }));
    start(async () => {
      const r = await toggleActivity({ date: day, key, on });
      if (!r.ok) {
        setActs(before);
        toast(r.error, "error");
        return;
      }
      setActs((a) => ({ ...a, [day]: r.data!.activities }));
      setStreak(r.data!.stats.current);
    });
    return true;
  }

  /** Week cell: today cycles empty, planned, done; yesterday toggles done; other days only plan. */
  function tapCell(day: string, kind: TrainingKind, isPlanned: boolean, done: boolean) {
    if (!dates.includes(day)) return plan(day, kind);
    if (done) {
      if (toggle(kind, day) && isPlanned && day >= today) plan(day, kind);
      return;
    }
    if (isPlanned || day < today) {
      toggle(kind, day);
      return;
    }
    plan(day, kind);
  }

  function setJoker(on: boolean) {
    setConfirmJoker(false);
    const before = jokers;
    setJokers((j) => (on ? [...j, date] : j.filter((d) => d !== date)));
    start(async () => {
      const r = on ? await spendJoker(date) : await undoJoker(date);
      if (!r.ok) {
        setJokers(before);
        toast(r.error, "error");
      } else toast(on ? "Joker ingezet. De squad krijgt een melding." : "Joker teruggedraaid.", "success");
    });
  }

  function plan(day: string, kind: TrainingKind) {
    const on = !planned.some((p) => p.plan_date === day && p.kind === kind);
    const before = planned;
    setPlanned((p) => (on ? [...p, { plan_date: day, kind }] : p.filter((x) => !(x.plan_date === day && x.kind === kind))));
    start(async () => {
      const r = await togglePlan({ date: day, kind, on });
      if (!r.ok) {
        setPlanned(before);
        toast(r.error, "error");
      }
    });
  }

  const shownStart = week === "this" ? weekStart : addDays(weekStart, 7);
  const progress = useMemo(
    () => weekProgress(shownStart, Object.entries(acts).map(([checkin_date, activities]) => ({ checkin_date, activities })), planned, jokers),
    [shownStart, acts, planned, jokers],
  );
  const plannedToday = TRAINING_KINDS.filter((k) => planned.some((p) => p.plan_date === date && p.kind === k));

  return (
    <div className="space-y-5">
      {dates.length > 1 ? (
        <div className="soft flex rounded-full p-1" role="tablist" aria-label="Dag">
          {dates.map((d) => (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={d === date}
              onClick={() => setDate(d)}
              className={cn("flex-1 rounded-full py-2 text-[13px] font-medium transition", d === date ? "bg-white text-ink shadow-sm" : "text-ink/70")}
            >
              {d === today ? "Vandaag" : "Gisteren"}
            </button>
          ))}
        </div>
      ) : null}

      <section className="espresso flex items-center gap-4 rounded-[22px] p-4" aria-label="Je dag">
        <Ring value={score.done / score.total} size={72} stroke={6} color="#a9b98f" track="rgba(255,255,255,0.15)">
          <span className="font-display text-[20px] leading-none">
            {score.done}
            <span className="text-[13px] opacity-70">/{score.total}</span>
          </span>
        </Ring>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[20px] leading-tight">{score.complete ? "Alle punten gehaald" : `${score.total - score.done} ${score.total - score.done === 1 ? "punt" : "punten"} te gaan`}</p>
          <p className="mt-0.5 text-[12.5px] opacity-80">{formatDateNl(date, { weekday: "long", day: "numeric", month: "long" })}</p>
        </div>
        <div className="text-center">
          <Flame className="mx-auto h-5 w-5 opacity-80" strokeWidth={1.6} />
          <p className="font-display text-[18px] leading-none">{streak}</p>
          <p className="text-[10px] uppercase tracking-wider opacity-70">streak</p>
        </div>
      </section>

      <section aria-label="Dagelijks">
        <h2 className="mb-2.5 px-0.5 font-display text-[19px]">Dagelijks</h2>
        <ul className="space-y-2">
          {DAILY_HABITS.map((key) => {
            const m = meta(key);
            const Icon = ACTIVITY_ICONS[key];
            const done = current.includes(key) || (key === "alcohol" && joker);
            const via = auto[date]?.[key];
            const hint =
              key === "hydration"
                ? `${formatMl(water[date] ?? 0)} van ${formatMl(WATER_GOAL_ML)}${via === "water" ? ", automatisch" : ""}`
                : key === "alcohol" && joker
                  ? "Joker ingezet"
                  : m.hint;
            return (
              <li key={key}>
                <div className={cn("glass flex items-center gap-3 rounded-[18px] py-2.5 pl-2.5 pr-3 transition", done && "bg-sage/15")}>
                  <button type="button" onClick={() => (key === "alcohol" && joker ? setJoker(false) : toggle(key))} aria-pressed={done} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full", done ? "bg-sage text-white" : "soft")}>
                      {done ? <Check className="h-5 w-5" strokeWidth={2.2} /> : <Icon className="h-5 w-5" strokeWidth={1.6} />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[14.5px] font-medium text-text">{key === "alcohol" && joker ? "Joker 🃏" : m.label}</span>
                      <span className="block truncate text-[11.5px] text-muted">{hint}</span>
                    </span>
                  </button>
                  {key === "hydration" ? (
                    <Link href="/water" className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11.5px] font-medium text-ink shadow-sm">
                      Water
                    </Link>
                  ) : null}
                  {key === "alcohol" && !joker && jokersLeft > 0 && !current.includes("alcohol") ? (
                    <button type="button" onClick={() => setConfirmJoker(true)} className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11.5px] font-medium text-ink shadow-sm">
                      Joker
                    </button>
                  ) : null}
                </div>
                {key === "alcohol" && confirmJoker ? (
                  <div className="soft mt-2 rounded-[16px] p-3 text-[13px]">
                    <p className="leading-snug">
                      Joker inzetten voor {date === today ? "vandaag" : "gisteren"}? Je hebt er nog {jokersLeft} van {maxJokers}. De squad krijgt een melding en een bericht in de chat.
                    </p>
                    <div className="mt-2.5 flex gap-2">
                      <button type="button" onClick={() => setJoker(true)} className="espresso rounded-full px-4 py-1.5 text-[12.5px] font-medium shadow-none">
                        Zet joker in
                      </button>
                      <button type="button" onClick={() => setConfirmJoker(false)} className="rounded-full bg-white px-4 py-1.5 text-[12.5px] font-medium text-ink">
                        Annuleren
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
        <p className="mt-2 px-0.5 text-[11.5px] text-muted">
          Jokers: {jokers.length} van {maxJokers} ingezet.
        </p>
      </section>

      <StepsCard
        today={today}
        weekStart={weekStart}
        date={date}
        challengeStart={challengeStart}
        challengeEnd={challengeEnd}
        logs={props.steps}
        ticks={Object.entries(acts).map(([checkin_date, activities]) => ({ checkin_date, activities }))}
        onStreak={setStreak}
      />

      <MyHabits date={date} initialHabits={props.habits} initialLogs={props.habitLogs} shared={props.habitsShared} />

      <section aria-label="Training">
        <h2 className="mb-2.5 px-0.5 font-display text-[19px]">Training {date === today ? "vandaag" : "gisteren"}</h2>
        <ul className="space-y-2">
          {TRAINING_KINDS.map((kind) => {
            const Icon = ACTIVITY_ICONS[kind];
            const done = current.includes(kind);
            const isPlanned = plannedToday.includes(kind);
            const via = auto[date]?.[kind];
            return (
              <li key={kind} className={cn("glass flex items-center gap-3 rounded-[18px] py-2.5 pl-2.5 pr-3", done && "bg-sage/15")}>
                <button type="button" onClick={() => toggle(kind)} aria-pressed={done} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full", done ? "bg-sage text-white" : "soft")}>
                    {done ? <Check className="h-5 w-5" strokeWidth={2.2} /> : <Icon className="h-5 w-5" strokeWidth={1.6} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[14.5px] font-medium text-text">{meta(kind).label}</span>
                    <span className="block text-[11.5px] text-muted">{via === "workout" ? "Vastgelegd in Fitness" : done ? "Afgevinkt" : isPlanned ? "Gepland" : "Niet gepland"}</span>
                  </span>
                </button>
                {!done ? (
                  <button type="button" onClick={() => toggle(kind)} className="espresso shrink-0 rounded-full px-3 py-1.5 text-[12px] font-medium shadow-none">
                    Afvinken
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
        <p className="mt-2 px-0.5 text-[11.5px] leading-snug text-muted">
          Getraind met een andere app? Afvinken telt mee voor je weekdoel. Tijd en afstand bewaren kan in{" "}
          <Link href="/fitness/start" className="inline-flex items-center font-medium text-ink underline-offset-2 hover:underline">
            Fitness <ChevronRight className="h-3 w-3" strokeWidth={1.8} />
          </Link>
        </p>
      </section>

      <section aria-label="Week">
        <div className="mb-2.5 flex items-center justify-between px-0.5">
          <h2 className="font-display text-[19px]">{week === "this" ? "Deze week" : "Volgende week"}</h2>
          <div className="soft flex rounded-full p-0.5 text-[12px]" role="tablist" aria-label="Week">
            {(["this", "next"] as const).map((w) => (
              <button key={w} type="button" role="tab" aria-selected={week === w} onClick={() => setWeek(w)} className={cn("rounded-full px-3 py-1 font-medium", week === w ? "bg-white text-ink shadow-sm" : "text-ink/70")}>
                {w === "this" ? "Deze" : "Volgende"}
              </button>
            ))}
          </div>
        </div>

        <div className="glass space-y-3 rounded-[20px] p-4">
          <div className="grid grid-cols-2 gap-3">
            {TRAINING_KINDS.map((kind) => {
              const t = progress.totals[kind];
              return (
                <div key={kind}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[12.5px] font-medium text-text">{TRAINING_LABEL[kind]}</span>
                    <span className="text-[12px] tabular-nums text-muted">
                      {t.done}/{WEEKLY_TARGETS[kind]}
                    </span>
                  </div>
                  <div className="mt-1.5 flex gap-1" aria-hidden>
                    {Array.from({ length: WEEKLY_TARGETS[kind] }).map((_, i) => (
                      <span key={i} className={cn("h-1.5 flex-1 rounded-full", i < t.done ? "bg-sage" : i < t.planned ? "bg-sage/35" : "bg-ink/10")} />
                    ))}
                  </div>
                  <p className="mt-1 text-[11px] text-muted">{t.planned} gepland</p>
                </div>
              );
            })}
          </div>

          <ol className="grid grid-cols-7 gap-1.5" aria-label="Plan je trainingen">
            {progress.days.map((d) => {
              const editable = dates.includes(d.date);
              const past = d.date < today && !editable;
              const outside = d.date < challengeStart || d.date > challengeEnd;
              return (
                <li key={d.date} className={cn("flex flex-col items-center gap-1", outside && "opacity-40")}>
                  <span className={cn("text-[10px] font-medium uppercase tracking-wide", d.date === today ? "text-ink" : "text-muted")}>{weekdayShortNl(d.date)}</span>
                  <span className={cn("text-[11px] tabular-nums", d.date === today ? "font-semibold text-ink" : "text-muted")}>{Number(d.date.slice(-2))}</span>
                  {TRAINING_KINDS.map((kind) => {
                    const done = d.done.includes(kind);
                    const isPlanned = d.planned.includes(kind);
                    return (
                      <button
                        key={kind}
                        type="button"
                        disabled={past || outside}
                        onClick={() => tapCell(d.date, kind, isPlanned, done)}
                        aria-pressed={isPlanned}
                        aria-label={`${TRAINING_LABEL[kind]} ${formatDateNl(d.date, { weekday: "long", day: "numeric", month: "long" })}${done ? ", gedaan" : isPlanned ? ", gepland" : ""}`}
                        className={cn(
                          "flex h-8 w-full items-center justify-center rounded-[10px] text-[11px] font-semibold transition",
                          done ? "bg-sage text-white" : isPlanned ? "border border-sage bg-sage/15 text-ink" : "border border-dashed border-ink/15 text-muted/70",
                          past && !done && !isPlanned && "border-transparent",
                        )}
                      >
                        {kind === "run" ? "R" : "K"}
                      </button>
                    );
                  })}
                  {d.joker ? <span className="text-[11px]" aria-label="Joker">🃏</span> : null}
                </li>
              );
            })}
          </ol>
          <p className="text-[11px] leading-snug text-muted">Tik op R (hardlopen) of K (kracht) om te plannen. Vandaag en gisteren tik je een geplande training nog een keer om hem af te vinken. Groen gevuld is gedaan.</p>
        </div>
      </section>
    </div>
  );
}
