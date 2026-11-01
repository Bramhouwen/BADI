import { Check } from "lucide-react";
import type { CalendarDay } from "@/lib/streaks";
import { weekdayShortNl } from "@/lib/dates";
import { Badge } from "@/components/ui/card";
import { Ring } from "@/components/ui/ring";
import { cn } from "@/lib/utils";

function StatTile({
  label,
  value,
  unit,
  badge,
  badgeTone,
  ring,
  ringColor,
  emoji,
}: {
  label: string;
  value: number;
  unit: string;
  badge: string;
  badgeTone: "ink" | "ice" | "warm" | "gold" | "success";
  ring: number;
  ringColor: string;
  emoji: string;
}) {
  return (
    <div className="tile flex w-[172px] shrink-0 flex-col justify-between rounded-[24px] p-4">
      <div>
        <p className="text-[13px] font-medium text-ink-muted">{label}</p>
        <p className="mt-1 text-[26px] font-semibold leading-none tracking-tight">
          {value} <span className="text-[14px] font-medium text-ink-muted">{unit}</span>
        </p>
      </div>
      <div className="mt-5 flex items-end justify-between">
        <Badge tone={badgeTone}>{badge}</Badge>
        <Ring value={ring} size={60} stroke={6} color={ringColor}>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-lg shadow-sm" aria-hidden>
            {emoji}
          </span>
        </Ring>
      </div>
    </div>
  );
}

export function StatTiles({ current, longest, total, challengeLength }: { current: number; longest: number; total: number; challengeLength: number }) {
  const streakBadge = current === 0 ? "Vandaag telt" : current >= 7 ? "Sterk" : "Lekker bezig";
  return (
    <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2" aria-label="Jouw cijfers">
      <StatTile label="Huidige streak" value={current} unit={current === 1 ? "dag" : "dagen"} badge={streakBadge} badgeTone="ink" ring={longest > 0 ? current / Math.max(longest, 7) : 0} ringColor="var(--warm)" emoji="🔥" />
      <StatTile label="Persoonlijk record" value={longest} unit={longest === 1 ? "dag" : "dagen"} badge={longest >= 14 ? "Top" : "Record"} badgeTone="ink" ring={Math.min(1, longest / 30)} ringColor="var(--gold)" emoji="🏅" />
      <StatTile label="Dagen voltooid" value={total} unit={`van ${challengeLength}`} badge={`${Math.round((total / Math.max(challengeLength, 1)) * 100)}%`} badgeTone="ink" ring={total / Math.max(challengeLength, 1)} ringColor="var(--ice-bright)" emoji="❄️" />
    </div>
  );
}

export function WeekCard({ calendar }: { calendar: CalendarDay[] }) {
  return (
    <section className="glass rounded-[24px] px-4 py-4" aria-label="Laatste zeven dagen">
      <ol className="flex justify-between">
        {calendar.map((d) => (
          <li key={d.date} className="flex flex-col items-center gap-2">
            <span className={cn("text-[11px] font-semibold uppercase tracking-wide", d.isToday ? "text-ice" : "text-muted")}>{weekdayShortNl(d.date)}</span>
            <span
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full text-[13px] font-semibold tabular-nums",
                d.done ? "tile" : d.isToday ? "border-2 border-ice text-ice" : "border border-white/20 text-text/70",
                !d.inChallenge && "opacity-35",
              )}
              aria-label={`${d.date}${d.done ? ", ingecheckt" : ""}`}
            >
              {d.done ? <Check className="h-4.5 w-4.5" strokeWidth={3} /> : Number(d.date.slice(-2))}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
