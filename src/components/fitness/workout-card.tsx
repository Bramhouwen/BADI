import Link from "next/link";
import { activityMeta, templateSummary } from "@/lib/fitness";
import type { TemplateRow } from "@/lib/fitness/data";
import { coverFor } from "@/lib/exercise-video";
import { cn } from "@/lib/utils";

/** Photo card for one workout of a plan; opens the workout page. */
export function WorkoutCard({ template, planName, className }: { template: TemplateRow; planName?: string; className?: string }) {
  const cover = coverFor(template.exercises.map((e) => e.name));
  const sum = templateSummary(template.exercises);
  const meta = activityMeta(template.activity_type);
  const Icon = meta.icon;
  return (
    <Link href={`/fitness/workouts/${template.id}`} className={cn("group relative block aspect-[4/5] overflow-hidden rounded-[22px] bg-[#6a3b2f] shadow-[0_14px_30px_-20px_rgba(95,53,41,0.7)]", className)}>
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element -- small static poster
        <img src={cover.poster} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center">
          <Icon className="h-10 w-10 text-paper/30" strokeWidth={1.4} />
        </span>
      )}
      <span className="absolute inset-0 bg-gradient-to-t from-[#3b2019]/85 via-[#3b2019]/25 to-transparent" />
      <span className="absolute inset-x-0 bottom-0 block p-3.5">
        {planName ? <span className="block truncate text-[10px] font-medium uppercase tracking-[0.18em] text-paper/70">{planName}</span> : null}
        <span className="mt-0.5 block font-display text-[20px] leading-[1.1] text-paper">{template.name}</span>
        <span className="mt-1 block truncate text-[11.5px] text-paper/85">
          {template.activity_type === "strength" ? `${sum.exercises} ${sum.exercises === 1 ? "oefening" : "oefeningen"}${sum.minutes > 0 ? ` · ± ${sum.minutes} min` : ""}` : meta.label}
        </span>
      </span>
    </Link>
  );
}

/** Horizontal, swipeable row of workout cards with a peek of the next one. */
export function WorkoutRow({ items }: { items: { template: TemplateRow; planName?: string }[] }) {
  return (
    <ul className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-2.5 overflow-x-auto scroll-px-5 px-5 pb-1">
      {items.map(({ template, planName }) => (
        <li key={template.id} className="w-[46%] shrink-0 snap-start">
          <WorkoutCard template={template} planName={planName} />
        </li>
      ))}
    </ul>
  );
}
