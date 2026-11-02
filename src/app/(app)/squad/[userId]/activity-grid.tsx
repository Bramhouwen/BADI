"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { weekdayShortNl } from "@/lib/dates";
import type { GridDay, GridMode } from "@/lib/squad-stats";

const MODES: { key: GridMode; label: string }[] = [
  { key: "week", label: "Deze week" },
  { key: "prev-week", label: "Vorige week" },
  { key: "month", label: "Deze maand" },
];

/** Minimal day grid: sage = workout, blush ring = check-in only, grey = nothing. */
export function ActivityGrid({ grids, showWorkouts, showCheckins }: { grids: Record<GridMode, GridDay[]>; showWorkouts: boolean; showCheckins: boolean }) {
  const [mode, setMode] = useState<GridMode>("week");
  const days = grids[mode];
  const active = days.filter((d) => !d.future && (d.workout || d.checkin)).length;
  const past = days.filter((d) => !d.future).length;

  return (
    <div className="glass rounded-[20px] px-4 py-3.5">
      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1" role="tablist" aria-label="Periode">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            role="tab"
            aria-selected={mode === m.key}
            onClick={() => setMode(m.key)}
            className={cn("shrink-0 rounded-full px-3 py-1.5 text-[12px] font-medium", mode === m.key ? "espresso shadow-none" : "soft")}
          >
            {m.label}
          </button>
        ))}
      </div>

      <ol className={cn("mt-3.5 grid gap-y-2.5", mode === "month" ? "grid-cols-7 gap-x-1.5" : "grid-cols-7 gap-x-2")} aria-label="Activiteit per dag">
        {days.map((d) => (
          <li key={d.date} className="flex flex-col items-center gap-1">
            {mode !== "month" ? <span className={cn("text-[10px] font-medium uppercase tracking-wide", d.isToday ? "text-ink" : "text-muted")}>{weekdayShortNl(d.date)}</span> : null}
            <span
              aria-label={`${d.date}${d.workout ? ", training" : ""}${d.checkin ? ", check-in" : ""}`}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-medium tabular-nums",
                d.future
                  ? "bg-blush/50 text-muted/50"
                  : d.workout
                    ? "bg-sage text-white"
                    : d.checkin
                      ? "border border-sage bg-sage/15 text-ink"
                      : "bg-blush text-muted",
                d.isToday && !d.workout && !d.checkin && "ring-1 ring-ink/30",
              )}
            >
              {d.workout ? <Check className="h-3.5 w-3.5" strokeWidth={2.2} /> : d.dayOfMonth}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-3 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11px] text-muted">
        <span className="tabular-nums">
          {active} van {past} dagen actief
        </span>
        {showWorkouts ? (
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-sage" aria-hidden /> training
          </span>
        ) : null}
        {showCheckins ? (
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border border-sage bg-sage/15" aria-hidden /> check-in
          </span>
        ) : null}
      </div>
    </div>
  );
}
