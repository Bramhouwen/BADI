import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";

export const BADDY_AVATAR_SRC = "/brand/baddy.png";

export function coachHref(question?: string): string {
  return question ? `/coach?q=${encodeURIComponent(question)}` : "/coach";
}

/** Compact link to Baddy with a pre-filled question. */
export function AskBaddyLink({ question, label }: { question: string; label: string }) {
  return (
    <Link href={coachHref(question)} className="glass flex items-center gap-3 rounded-[18px] py-2 pl-2 pr-3.5 hover:bg-blush/40">
      <Avatar name="Baddy" src={BADDY_AVATAR_SRC} size="sm" />
      <span className="min-w-0 flex-1 text-[13.5px] font-medium text-text">{label}</span>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted" strokeWidth={1.7} />
    </Link>
  );
}

/** Home card: what Baddy does, with two direct questions. */
export function BaddyCard() {
  return (
    <section className="glass rounded-[20px] p-4" aria-label="Baddy de Coach">
      <Link href="/coach" className="flex items-center gap-3">
        <Avatar name="Baddy" src={BADDY_AVATAR_SRC} size="md" />
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[18px] leading-tight text-text">Vraag Baddy</span>
          <span className="block text-[11.5px] leading-snug text-muted">Recepten zonder toegevoegde suiker, schema&apos;s en tips.</span>
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted" strokeWidth={1.7} />
      </Link>
      <div className="mt-3 flex flex-wrap gap-2">
        {["Maak een avondeten met veel eiwit", "Tips voor 10.000 stappen"].map((q) => (
          <Link key={q} href={coachHref(q)} className="soft rounded-full px-3 py-1.5 text-[12px] font-medium text-ink">
            {q}
          </Link>
        ))}
      </div>
    </section>
  );
}
