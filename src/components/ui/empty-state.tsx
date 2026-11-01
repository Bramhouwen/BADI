import type { ReactNode } from "react";

export function EmptyState({ emoji, title, body, action }: { emoji: string; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[20px] border border-dashed border-border px-6 py-10 text-center">
      <div className="text-4xl" aria-hidden>
        {emoji}
      </div>
      <h3 className="mt-3 text-base font-semibold">{title}</h3>
      {body ? <p className="mt-1 max-w-xs text-sm text-muted">{body}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
