import type { ReactNode } from "react";

export function EmptyState({ emoji, title, body, action }: { emoji: string; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="glass flex flex-col items-center rounded-[24px] px-6 py-10 text-center">
      <div className="tile flex h-16 w-16 items-center justify-center rounded-full text-3xl" aria-hidden>
        {emoji}
      </div>
      <h3 className="mt-4 font-display text-xl">{title}</h3>
      {body ? <p className="mt-1 max-w-xs text-sm text-muted">{body}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
