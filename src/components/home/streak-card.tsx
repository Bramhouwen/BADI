import { Award, Check, Flame, Snowflake, type LucideIcon } from "lucide-react";
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
  ring,
  ringColor,
  icon: Icon,
}: {
  label: string;
  value: number;
  unit: string;
  badge: string;
  ring: number;
  ringColor: string;
  icon: LucideIcon;
}) {
  return (
    <div className="glass flex w-[168px] shrink-0 flex-col justify-between rounded-[22px] p-4">
      <div>
        <p className="text-[12px] text-muted">{label}</p>
        <p className="mt-1 font-display text-[30px] leading-none text-text">
          {value} <span className="font-sans text-[13px] text-muted">{unit}</span>
        </p>
      </div>
      <div className="mt-5 flex items-end justify-between">
        <Badge tone="ink">{badge}</Badge>
        <Ring value={ring} size={54} stroke={4} color={ringColor} track="rgba(107,58,46,0.08)">
          <span className="soft flex h-9 w-9 items-center justify-center rounded-full">
            <Icon size={16} strokeWidth={1.6} />
          </span>
        </Ring>
      </div>
    </div>
  );
}

export function StatTiles({ current, longest, total, challengeLength }: { current: number; longest: number; total: number; challengeLength: number }) {
  const streakBadge = current === 0 ? "Vandaag telt" : current >= 7 ? "Sterk" : "Lekker bezig";
  return (
    <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 pb-2" aria-label="Jouw cijfers">
      <StatTile label="Huidige streak" value={current} unit={current === 1 ? "dag" : "dagen"} badge={streakBadge} ring={longest > 0 ? current / Math.max(longest, 7) : 0} ringColor="var(--warm)" icon={Flame} />
      <StatTile label="Persoonlijk record" value={longest} unit={longest === 1 ? "dag" : "dagen"} badge={longest >= 14 ? "Top" : "Record"} ring={Math.min(1, longest / 30)} ringColor="var(--gold)" icon={Award} />
      <StatTile label="Dagen voltooid" value={total} unit={`van ${challengeLength}`} badge={`${Math.round((total / Math.max(challengeLength, 1)) * 100)}%`} ring={total / Math.max(challengeLength, 1)} ringColor="var(--sage)" icon={Snowflake} />
    </div>
  );
}

export function WeekCard({ calendar }: { calendar: CalendarDay[] }) {
  return (
    <section className="glass rounded-[20px] px-4 py-3.5" aria-label="Laatste zeven dagen">
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="font-display text-[17px] text-text">Deze week</h2>
        <Badge tone="ink">{calendar.filter((d) => d.done).length} van 7 dagen</Badge>
      </div>
      <ol className="flex justify-between">
        {calendar.map((d) => (
          <li key={d.date} className="flex flex-col items-center gap-2">
            <span className={cn("text-[10px] font-medium uppercase tracking-wide", d.isToday ? "text-ink" : "text-muted")}>{weekdayShortNl(d.date)}</span>
            <span
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-medium tabular-nums",
                d.done ? "bg-sage text-white" : d.isToday ? "border border-sage text-ink" : "bg-blush text-muted",
                !d.inChallenge && "opacity-40",
              )}
              aria-label={`${d.date}${d.done ? ", ingecheckt" : ""}`}
            >
              {d.done ? <Check className="h-4 w-4" strokeWidth={2} /> : Number(d.date.slice(-2))}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
