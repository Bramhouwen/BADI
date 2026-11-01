import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { IconBadge } from "./icon-badge";

export function EmptyState({ emoji, icon, title, body, action }: { emoji?: string; icon?: LucideIcon; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="glass flex flex-col items-center rounded-[24px] px-6 py-10 text-center">
      {icon ? (
        <IconBadge icon={icon} size="lg" />
      ) : (
        <div className="soft flex h-14 w-14 items-center justify-center rounded-[18px] text-2xl" aria-hidden>
          {emoji}
        </div>
      )}
      <h3 className="mt-4 font-display text-[20px]">{title}</h3>
      {body ? <p className="mt-1 max-w-xs text-sm text-muted">{body}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
