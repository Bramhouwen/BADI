import Link from "next/link";
import { ArrowRight, Dumbbell } from "lucide-react";
import { IconBadge } from "@/components/ui/icon-badge";
import { activityMeta } from "@/lib/fitness";
import { formatDateNl } from "@/lib/dates";

/** Quick access to the Fitness Tracker from Home, with real numbers only. */
export function FitnessCard({ weekWorkouts, last }: { weekWorkouts: number; last: { title: string; date: string; type: string } | null }) {
  return (
    <Link href="/fitness" className="glass flex items-center gap-3 rounded-[20px] px-3 py-3 pr-3.5 hover:bg-blush/40">
      <IconBadge icon={Dumbbell} size="md" tone="sage" />
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[17px] leading-tight text-text">Fitness Tracker</span>
        <span className="block text-[11.5px] text-muted">Jouw beweging. Jouw kracht. Jouw progressie.</span>
        {last ? (
          <span className="mt-0.5 block truncate text-[11.5px] text-ink/80">
            {weekWorkouts} {weekWorkouts === 1 ? "training" : "trainingen"} deze week · laatste: {activityMeta(last.type).label} op {formatDateNl(last.date, { day: "numeric", month: "short" })}
          </span>
        ) : null}
      </span>
      <span className="soft flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-[12px] font-medium" aria-hidden>
        Bekijk <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
      </span>
    </Link>
  );
}
