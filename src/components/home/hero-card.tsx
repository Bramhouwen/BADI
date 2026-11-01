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
    <section className="relative overflow-hidden rounded-[22px] bg-[#6a3b2f] text-paper shadow-[0_16px_34px_-20px_rgba(95,53,41,0.65)]" aria-label="Check-in van vandaag">
      <div className="absolute inset-y-0 right-0 w-[58%]">
        <Image src="/photos/runner.jpg" alt="" fill sizes="(max-width: 512px) 55vw, 280px" className="object-cover object-[60%_20%]" priority />
        <div className="absolute inset-0 bg-gradient-to-r from-[#6a3b2f] via-[#6a3b2f]/45 to-[#6a3b2f]/0" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#6a3b2f]/75 via-[#6a3b2f]/10 to-transparent" />
        <div className="absolute inset-0 bg-[#8a5447]/20 mix-blend-multiply" />
      </div>
      <div className="relative flex min-h-[172px] flex-col justify-between p-5">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-paper/70">{checkedIn ? "Vandaag ingecheckt" : "Check-in van vandaag"}</p>
          <h2 className="mt-2 max-w-[68%] font-display text-[26px] italic leading-[1.1] text-paper">
            {checkedIn ? "Je bent er weer voor gegaan." : "Today I showed up."}
          </h2>
        </div>
        <div className="mt-4 flex items-end justify-between gap-3">
          <div className="flex items-center gap-3 text-[12px] text-paper/85">
            {checkedIn ? (
              <span className="flex items-center gap-1.5">
                <Check size={14} strokeWidth={1.8} /> {activities} {activities === 1 ? "activiteit" : "activiteiten"}
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Timer size={14} strokeWidth={1.8} /> 10 sec
              </span>
            )}
            <span className="h-3 w-px bg-paper/35" aria-hidden />
            <span className="flex items-center gap-1.5 truncate">
              <ListChecks size={14} strokeWidth={1.8} /> {checkedIn ? (note ? `“${note}”` : "Lekker bezig") : "Eén is genoeg"}
            </span>
          </div>
          {checkedIn ? (
            canEdit ? (
              <Link href="/checkin" aria-label="Check-in aanpassen" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-paper on-tile shadow-md">
                <Pencil size={17} strokeWidth={1.7} />
              </Link>
            ) : null
          ) : (
            <Link href="/checkin" aria-label="Check vandaag in" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-paper on-tile shadow-md">
              <ArrowRight size={19} strokeWidth={1.8} />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
