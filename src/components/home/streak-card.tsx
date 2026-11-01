"use client";

import { motion, useReducedMotion } from "motion/react";
import { Check } from "lucide-react";
import type { CalendarDay } from "@/lib/streaks";
import { weekdayShortNl } from "@/lib/dates";
import { cn } from "@/lib/utils";

export function StreakCard({ current, longest, total, calendar }: { current: number; longest: number; total: number; calendar: CalendarDay[] }) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-[24px] border border-border/70 bg-card p-5"
      aria-label="Jouw streak"
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-ice/10 blur-3xl" aria-hidden />
      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-extrabold tabular-nums tracking-tight">
              <span className="mr-1 text-4xl" aria-hidden>
                🔥
              </span>
              {current}
            </span>
            <span className="text-lg font-semibold text-muted">{current === 1 ? "dag" : "dagen"}</span>
          </div>
          <p className="mt-1 text-sm text-muted">Jouw huidige streak</p>
        </div>
        <div className="text-right text-xs text-muted">
          <p>
            Record <span className="font-semibold text-text">{longest}</span>
          </p>
          <p>
            Totaal <span className="font-semibold text-text">{total}</span>
          </p>
        </div>
      </div>

      <ol className="mt-5 flex justify-between" aria-label="Laatste zeven dagen">
        {calendar.map((d) => (
          <li key={d.date} className="flex flex-col items-center gap-1.5">
            <span className={cn("text-[10px] font-semibold uppercase", d.isToday ? "text-ice" : "text-muted")}>{weekdayShortNl(d.date)}</span>
            <span
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full border text-xs tabular-nums",
                d.done ? "border-ice bg-ice text-bg" : d.isToday ? "border-ice/60 bg-transparent text-ice" : "border-border bg-bg-2 text-muted",
                !d.inChallenge && "opacity-40",
              )}
              aria-label={`${d.date}${d.done ? ", ingecheckt" : ""}`}
            >
              {d.done ? <Check className="h-4 w-4" strokeWidth={3} /> : Number(d.date.slice(-2))}
            </span>
          </li>
        ))}
      </ol>
    </motion.section>
  );
}
