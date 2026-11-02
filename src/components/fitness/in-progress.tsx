"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { ACTIVITY_TYPES, CARDIO_TIMER_KEY, activityMeta, formatDuration, timerElapsed, type ActivityType, type TimerState } from "@/lib/fitness";
import { IconBadge } from "@/components/ui/icon-badge";
import { SectionTitle } from "@/components/ui/card";
import { DiscardDraftButton } from "./session-actions";

export interface OpenDraft {
  id: string;
  title: string;
  type: ActivityType;
  /** "Gestart 18:05" or "Achteraf invullen". */
  status: string;
}

interface Running {
  type: ActivityType;
  timer: TimerState;
}

function readTimers(): Running[] {
  const out: Running[] = [];
  try {
    for (const a of ACTIVITY_TYPES) {
      if (a.kind === "strength") continue;
      const raw = localStorage.getItem(`${CARDIO_TIMER_KEY}:${a.key}`);
      if (raw) out.push({ type: a.key, timer: JSON.parse(raw) as TimerState });
    }
  } catch {}
  return out;
}

const trash = "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-muted shadow-sm ring-1 ring-ink/[0.06] hover:text-danger";

/**
 * Everything that is started but not saved: strength drafts from the database and cardio timers
 * from this device. Each row continues or discards. Renders nothing when nothing is open.
 */
export function InProgress({ drafts }: { drafts: OpenDraft[] }) {
  const [timers, setTimers] = useState<Running[]>([]);
  const [, setTick] = useState(0);

  useEffect(() => {
    // localStorage only exists in the browser, so timers fill in after mounting.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTimers(readTimers());
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  function discardTimer(type: ActivityType) {
    if (!confirm("Deze training annuleren? De timer gaat verloren.")) return;
    try {
      localStorage.removeItem(`${CARDIO_TIMER_KEY}:${type}`);
    } catch {}
    setTimers((l) => l.filter((x) => x.type !== type));
  }

  if (drafts.length + timers.length === 0) return null;
  return (
    <section aria-label="Bezig">
      <SectionTitle>Bezig</SectionTitle>
      <ul className="space-y-2">
        {drafts.map((d) => (
          <li key={d.id} className="glass flex items-center gap-3 rounded-[18px] py-2.5 pl-2.5 pr-2.5">
            <IconBadge icon={activityMeta(d.type).icon} size="md" tone="white" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-medium text-text">{d.title}</span>
              <span className="block truncate text-[11.5px] text-muted">{d.status}</span>
            </span>
            <Link href={`/fitness/workout/${d.id}`} className="espresso flex h-10 shrink-0 items-center rounded-full px-4 shadow-none">
              <span className="text-[13px] font-medium">Verder</span>
            </Link>
            <DiscardDraftButton id={d.id} />
          </li>
        ))}
        {timers.map(({ type, timer }) => {
          const meta = activityMeta(type);
          const shown = formatDuration(timerElapsed(timer));
          return (
            <li key={type} className="glass flex items-center gap-3 rounded-[18px] py-2.5 pl-2.5 pr-2.5">
              <IconBadge icon={meta.icon} size="md" tone="white" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium text-text">{meta.label}</span>
                <span className="block truncate text-[11.5px] tabular-nums text-muted">
                  {timer.startedAt !== null ? "Timer loopt" : "Gepauzeerd"} · {shown === "–" ? "0s" : shown}
                </span>
              </span>
              <Link href={`/fitness/start/${type}`} className="espresso flex h-10 shrink-0 items-center rounded-full px-4 shadow-none">
                <span className="text-[13px] font-medium">Verder</span>
              </Link>
              <button type="button" onClick={() => discardTimer(type)} aria-label={`${meta.label} annuleren`} className={trash}>
                <Trash2 className="h-4 w-4" strokeWidth={1.7} />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
