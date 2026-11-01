import Link from "next/link";
import { relativeTimeNl } from "@/lib/dates";
import { EmptyState } from "@/components/ui/empty-state";
import { Camera, ChefHat, Flame, HandHeart, Sprout, type LucideIcon } from "lucide-react";
import { IconBadge } from "@/components/ui/icon-badge";

const ICONS: Record<string, LucideIcon> = { "❄️": Flame, "🥑": ChefHat, "📸": Camera, "💌": HandHeart };

export interface TimelineItem {
  at: string;
  text: string;
  emoji: string;
  href?: string;
}

export function SquadTimeline({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) return <EmptyState icon={Sprout} title="Nog rustig" body="Zodra iemand incheckt, een recept deelt of een foto plaatst, zie je het hier." />;
  return (
    <ol className="space-y-2">
      {items.map((it, i) => {
        const inner = (
          <>
            <IconBadge icon={ICONS[it.emoji] ?? Flame} size="sm" className="rounded-full" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm leading-snug">{it.text}</span>
              <span className="block text-xs text-muted">{relativeTimeNl(it.at)}</span>
            </span>
          </>
        );
        const cls = "glass flex items-center gap-3 rounded-[18px] py-2.5 pl-2.5 pr-4";
        return (
          <li key={i}>
            {it.href ? (
              <Link href={it.href} className={cls + " hover:bg-blush/40"}>
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
