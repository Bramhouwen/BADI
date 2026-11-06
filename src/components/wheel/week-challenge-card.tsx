import Image from "next/image";
import Link from "next/link";
import { Check } from "lucide-react";
import { CHALLENGE_META, type ChallengeProgress, type WheelChallengeKey } from "@/lib/wheel";
import { cn } from "@/lib/utils";
import { ChallengeDoneButton } from "./challenge-done";

const ACTION: Partial<Record<WheelChallengeKey, { href: string; label: string }>> = {
  buddy: { href: "/squad", label: "Naar de squad" },
  recipe: { href: "/kitchen/new", label: "Recept toevoegen" },
};

/**
 * The extra challenge from the Weekrad as part of this week's check-in, up to
 * and including Sunday: what to do, where it stands and how to finish it.
 */
export function WeekChallengeCard({ spinId, challengeKey, progress, completed }: { spinId: string; challengeKey: WheelChallengeKey; progress: ChallengeProgress | null; completed: boolean }) {
  const meta = CHALLENGE_META[challengeKey];
  const done = completed || Boolean(progress?.complete);
  const action = ACTION[challengeKey];
  return (
    <section aria-label="Extra weekchallenge" className={cn("glass rounded-[22px] p-4", done ? "ring-1 ring-sage/40" : "ring-1 ring-gold/40")}>
      <div className="flex items-start gap-3">
        <Image src={meta.image} alt="" width={128} height={128} className="h-16 w-16 shrink-0 rounded-[14px] object-cover" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Extra weekchallenge · t/m zondag</p>
          <p className="mt-0.5 text-[15px] font-semibold text-text">{meta.title}</p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{meta.rule}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {done ? (
          <span className="flex items-center gap-1.5 rounded-full bg-sage/25 px-3 py-1.5 text-[12.5px] font-medium text-ink">
            <Check className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden /> Gedaan · +5 bonus deze week
          </span>
        ) : meta.mode === "manual" ? (
          <ChallengeDoneButton spinId={spinId} />
        ) : (
          <>
            {progress && challengeKey === "buddy" ? (
              <span className="text-[12.5px] text-muted">
                {progress.done} van {progress.total} complimenten
              </span>
            ) : null}
            {action ? (
              <Link href={action.href} className="espresso inline-flex h-10 items-center rounded-full px-4 text-[13px] font-semibold">
                {action.label}
              </Link>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
