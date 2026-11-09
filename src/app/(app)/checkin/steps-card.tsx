"use client";

import { useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { ACTIVITY_ICONS } from "@/lib/activity-icons";
import { setSteps } from "@/app/actions/checkins";
import { STEPS_PER_POINT, WEEKLY_STEP_POINTS, WEEKLY_STEPS_GOAL, stepPoints, stepsByDay, weekDates } from "@/lib/checkin-plan";
import { addDays, formatDateNl, weekdayShortNl } from "@/lib/dates";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const nl = new Intl.NumberFormat("nl-NL");
const StepsIcon = ACTIVITY_ICONS.steps;

/**
 * Steps as a weekly goal: the week total against 70.000 (1 point per 10.000,
 * at most 7), a bar per day and one field to type the count of a day. Days of
 * this week up to today, plus yesterday, can be filled in. Last week folds out
 * below, so on Monday Sunday's steps can still be added.
 */
export function StepsCard({
  today,
  weekStart,
  date,
  editable,
  challengeStart,
  challengeEnd,
  logs: initialLogs,
  ticks,
  onStreak,
}: {
  today: string;
  weekStart: string;
  /** The day picked at the top of the check-in (today or yesterday). */
  date: string;
  /** Today and yesterday. */
  editable: string[];
  challengeStart: string;
  challengeEnd: string;
  logs: { log_date: string; steps: number }[];
  /** Check-ins of this week and last week, for days ticked as "steps" before steps became a weekly goal. */
  ticks: { checkin_date: string; activities: readonly string[] }[];
  onStreak: (streak: number) => void;
}) {
  const [logs, setLogs] = useState(initialLogs);
  const canEdit = (d: string) => d >= challengeStart && d <= challengeEnd && d <= today && (d >= weekStart || editable.includes(d));
  const [day, setDay] = useState(date);
  const [seenDate, setSeenDate] = useState(date);
  // Switching between today and yesterday at the top also moves the field.
  if (date !== seenDate) {
    setSeenDate(date);
    setDay(date);
  }
  const perDay = stepsByDay(weekStart, logs, ticks);
  const prevStart = addDays(weekStart, -7);
  const prevPerDay = stepsByDay(prevStart, logs, ticks);
  const prevTotal = weekDates(prevStart).reduce((n, d) => n + (prevPerDay[d] ?? 0), 0);
  const showPrev = prevStart >= addDays(challengeStart, -6);
  // Open by default while a day of last week can still be filled in (on Monday: Sunday).
  const [prevOpen, setPrevOpen] = useState(() => weekDates(prevStart).some((d) => canEdit(d)));
  const [seenDayForPrev, setSeenDayForPrev] = useState(day);
  if (seenDayForPrev !== day) {
    setSeenDayForPrev(day);
    if (day < weekStart) setPrevOpen(true);
  }
  const own = logs.find((l) => l.log_date === day);
  const [text, setText] = useState(own ? String(own.steps) : "");
  const [textFor, setTextFor] = useState(day);
  if (textFor !== day) {
    setTextFor(day);
    setText(own ? String(own.steps) : "");
  }
  const [pending, start] = useTransition();
  const toast = useToast();

  const total = weekDates(weekStart).reduce((n, d) => n + (perDay[d] ?? 0), 0);
  const points = stepPoints(total);
  const left = Math.max(0, WEEKLY_STEPS_GOAL - total);
  const typed = text === "" ? null : Number(text);
  const changed = typed !== (own ? own.steps : null);

  function save() {
    if (!changed) return;
    const before = logs;
    setLogs((l) => (typed === null ? l.filter((x) => x.log_date !== day) : [...l.filter((x) => x.log_date !== day), { log_date: day, steps: typed }]));
    start(async () => {
      const r = await setSteps({ date: day, steps: typed });
      if (!r.ok) {
        setLogs(before);
        toast(r.error, "error");
        return;
      }
      if (r.data?.stats) onStreak(r.data.stats.current);
      toast("Stappen opgeslagen", "success");
    });
  }

  function dayGrid(start: string, values: Record<string, number>, label: string) {
    return (
      <ol className="grid grid-cols-7 gap-1.5" aria-label={label}>
        {weekDates(start).map((d) => {
          const v = values[d] ?? 0;
          const pick = canEdit(d);
          return (
              <li key={d}>
              <button
                type="button"
                disabled={!pick}
                onClick={() => setDay(d)}
                aria-pressed={d === day}
                aria-label={`${formatDateNl(d, { weekday: "long", day: "numeric", month: "long" })}: ${nl.format(v)} stappen`}
                className={cn("flex w-full flex-col items-center gap-1 rounded-[12px] py-1.5 transition", d === day ? "bg-white shadow-sm" : "", !pick && "opacity-45")}
              >
                <span className="flex h-12 w-2.5 items-end overflow-hidden rounded-full bg-ink/10" aria-hidden>
                  <span className={cn("block w-full rounded-full", v >= STEPS_PER_POINT ? "bg-sage" : "bg-sage/50")} style={{ height: `${Math.min(1, v / STEPS_PER_POINT) * 100}%` }} />
                </span>
                <span className={cn("text-[10px] font-medium uppercase", d === today ? "text-ink" : "text-muted")}>{weekdayShortNl(d)}</span>
                <span className="text-[10px] tabular-nums text-muted">{v ? `${Math.round(v / 100) / 10}k`.replace(".", ",") : "–"}</span>
              </button>
            </li>
          );
        })}
      </ol>
    );
  }

  const dayLabel = day === today ? "vandaag" : formatDateNl(day, { weekday: "long", day: "numeric", month: "long" });
  return (
    <section aria-label="Stappen deze week">
      <h2 className="mb-2.5 px-0.5 font-display text-[19px]">Stappen deze week</h2>
      <div className="glass space-y-3.5 rounded-[20px] p-4">
        <div className="flex items-end justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full", points === WEEKLY_STEP_POINTS ? "bg-sage text-white" : "soft")}>
              <StepsIcon className="h-5 w-5" strokeWidth={1.6} />
            </span>
            <span>
              <span className="block font-display text-[22px] leading-none tabular-nums text-text">{nl.format(total)}</span>
              <span className="mt-1 block text-[11.5px] text-muted">van {nl.format(WEEKLY_STEPS_GOAL)}</span>
            </span>
          </div>
          <span className="text-right">
            <span className="block text-[13px] font-medium tabular-nums text-text">
              {points} van {WEEKLY_STEP_POINTS} punten
            </span>
            <span className="block text-[11.5px] text-muted">{left > 0 ? `Nog ${nl.format(left)}` : "Weekdoel gehaald"}</span>
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-ink/10" aria-hidden>
          <div className="h-full rounded-full bg-sage transition-[width] duration-500" style={{ width: `${Math.min(1, total / WEEKLY_STEPS_GOAL) * 100}%` }} />
        </div>

        {dayGrid(weekStart, perDay, "Stappen per dag deze week")}

        {showPrev ? (
          <div className="rounded-[16px] bg-white/60 ring-1 ring-ink/[0.06]">
            <button
              type="button"
              onClick={() => setPrevOpen((o) => !o)}
              aria-expanded={prevOpen}
              className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left"
            >
              <span className="text-[13px] font-medium text-text">Vorige week</span>
              <span className="flex items-center gap-2 text-[12px] tabular-nums text-muted">
                {nl.format(prevTotal)} · {stepPoints(prevTotal)} van {WEEKLY_STEP_POINTS} punten
                <ChevronDown className={cn("h-4 w-4 transition-transform", prevOpen && "rotate-180")} strokeWidth={1.8} aria-hidden />
              </span>
            </button>
            {prevOpen ? <div className="px-1.5 pb-2">{dayGrid(prevStart, prevPerDay, "Stappen per dag vorige week")}</div> : null}
          </div>
        ) : null}


        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-[11.5px] text-muted">Stappen {dayLabel}</span>
            <input
              type="text"
              inputMode="numeric"
              value={text}
              onChange={(e) => setText(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onBlur={save}
              placeholder="Bijv. 8500"
              className="h-11 w-full rounded-[14px] border border-ink/10 bg-white px-4 text-[16px] tabular-nums text-text outline-none focus:border-ink/30"
            />
          </label>
          <button type="submit" disabled={!changed || pending} className="espresso mt-5 h-11 shrink-0 rounded-full px-4 shadow-none disabled:opacity-40">
            <span className="text-[13px] font-medium">Opslaan</span>
          </button>
        </form>
        <p className="text-[11px] leading-snug text-muted">Neem het aantal over uit de Gezondheid-app van je telefoon. Elke 10.000 stappen in de week is 1 punt, zo kun je een rustige dag later inhalen.</p>
      </div>
    </section>
  );
}
