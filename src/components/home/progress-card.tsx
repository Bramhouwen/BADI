import Link from "next/link";
import { Ring } from "@/components/ui/ring";
import type { CalendarDay } from "@/lib/streaks";
import { cn } from "@/lib/utils";

export function ProgressCard({ calendar, current, longest, total, challengeLength }: { calendar: CalendarDay[]; current: number; longest: number; total: number; challengeLength: number }) {
  const weekDone = calendar.filter((d) => d.done).length;
  const pct = Math.round((weekDone / 7) * 100);
  return (
    <Link href="/checkin" className="glass flex items-center gap-4 rounded-[22px] p-4">
      <Ring value={weekDone / 7} size={68} stroke={6} color="var(--sage)" track="rgba(110,64,52,0.08)">
        <span className="font-sans text-[15px] font-medium text-text">{pct}%</span>
      </Ring>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium text-text">Deze week</p>
        <p className="text-[12px] text-muted">
          {weekDone} van 7 check-ins · streak {current} {current === 1 ? "dag" : "dagen"}
        </p>
        <p className="text-[12px] text-muted">
          Record {longest} · {total} van {challengeLength} dagen voltooid
        </p>
      </div>
      <div className="flex h-9 items-end gap-1" aria-hidden>
        {calendar.map((d) => (
          <span key={d.date} className={cn("w-1.5 rounded-full", d.done ? "h-8 bg-sage" : d.isToday ? "h-4 bg-ink/30" : "h-3 bg-ink/15")} />
        ))}
      </div>
    </Link>
  );
}
