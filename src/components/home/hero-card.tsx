import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, ListChecks, Pencil, Timer } from "lucide-react";

interface Props {
  checkedIn: boolean;
  activities: number;
  note: string | null;
  canEdit: boolean;
}

/** Espresso hero with brand photography, like "Today's workout" in the design. */
export function HeroCard({ checkedIn, activities, note, canEdit }: Props) {
  return (
    <section className="espresso relative overflow-hidden rounded-[24px]" aria-label="Check-in van vandaag">
      <div className="absolute inset-y-0 right-0 w-[55%]">
        <Image src="/photos/runner.jpg" alt="" fill sizes="(max-width: 512px) 55vw, 280px" className="object-cover object-[60%_20%]" priority />
        <div className="absolute inset-0 bg-gradient-to-r from-[#6e4034] via-[#6e4034]/55 to-[#6e4034]/10" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#6e4034]/70 via-transparent to-transparent" />
      </div>
      <div className="relative flex min-h-[188px] flex-col justify-between p-5">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">{checkedIn ? "Vandaag ingecheckt" : "Check-in van vandaag"}</p>
          <h2 className="mt-2 max-w-[62%] font-display text-[30px] italic leading-[1.05] text-paper">
            {checkedIn ? "Je bent er weer voor gegaan." : "Today I showed up."}
          </h2>
        </div>
        <div className="mt-5 flex items-end justify-between gap-3">
          <div className="flex items-center gap-4 text-[12px] text-paper/85">
            {checkedIn ? (
              <span className="flex items-center gap-1.5">
                <Check size={14} strokeWidth={1.8} /> {activities} {activities === 1 ? "activiteit" : "activiteiten"}
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Timer size={14} strokeWidth={1.8} /> 10 sec
              </span>
            )}
            <span className="h-3 w-px bg-paper/30" aria-hidden />
            <span className="flex items-center gap-1.5 truncate">
              <ListChecks size={14} strokeWidth={1.8} /> {checkedIn ? (note ? `“${note}”` : "Lekker bezig") : "Eén is genoeg"}
            </span>
          </div>
          {checkedIn ? (
            canEdit ? (
              <Link href="/checkin" aria-label="Check-in aanpassen" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-paper on-tile shadow-md">
                <Pencil size={18} strokeWidth={1.7} />
              </Link>
            ) : null
          ) : (
            <Link href="/checkin" aria-label="Check vandaag in" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-paper on-tile shadow-md">
              <ArrowRight size={20} strokeWidth={1.8} />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
