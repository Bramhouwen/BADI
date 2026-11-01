import Link from "next/link";
import { relativeTimeNl } from "@/lib/dates";
import { EmptyState } from "@/components/ui/empty-state";

export interface TimelineItem {
  at: string;
  text: string;
  emoji: string;
  href?: string;
}

export function SquadTimeline({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) return <EmptyState emoji="🌱" title="Nog rustig" body="Zodra iemand incheckt, een recept deelt of een foto plaatst, zie je het hier." />;
  return (
    <ol className="space-y-2">
      {items.map((it, i) => {
        const inner = (
          <>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg-2 text-lg" aria-hidden>
              {it.emoji}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm leading-snug">{it.text}</span>
              <span className="block text-xs text-muted">{relativeTimeNl(it.at)}</span>
            </span>
          </>
        );
        const cls = "flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-3 py-2.5";
        return (
          <li key={i}>
            {it.href ? (
              <Link href={it.href} className={cls + " hover:bg-card-2"}>
                {inner}
              </Link>
            ) : (
              <div className={cls}>{inner}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
