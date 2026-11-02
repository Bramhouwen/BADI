import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";

export const BADDY_AVATAR_SRC = "/brand/baddy.jpg";

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
