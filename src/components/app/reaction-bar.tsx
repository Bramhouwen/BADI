"use client";

import { useOptimistic, useTransition } from "react";
import { motion, useReducedMotion } from "motion/react";
import { REACTIONS, type ReactionKey } from "@/lib/constants";
import { cn } from "@/lib/utils";

export interface ReactionState {
  counts: Partial<Record<ReactionKey, number>>;
  mine: ReactionKey | null;
}

export function ReactionBar({
  state,
  onSet,
  compact,
}: {
  state: ReactionState;
  onSet: (reaction: ReactionKey | null) => Promise<void>;
  compact?: boolean;
}) {
  const [pending, start] = useTransition();
  const reduce = useReducedMotion();
  const [optimistic, apply] = useOptimistic(state, (prev: ReactionState, next: ReactionKey | null) => {
    const counts = { ...prev.counts };
    if (prev.mine) counts[prev.mine] = Math.max(0, (counts[prev.mine] ?? 1) - 1);
    if (next) counts[next] = (counts[next] ?? 0) + 1;
    return { counts, mine: next };
  });

  const total = Object.values(optimistic.counts).reduce((a, b) => a + (b ?? 0), 0);

  return (
    <div className={cn("flex items-center gap-1.5", compact && "gap-1")}>
      {REACTIONS.map((r) => {
        const active = optimistic.mine === r.key;
        const n = optimistic.counts[r.key] ?? 0;
        return (
          <motion.button
            key={r.key}
            type="button"
            aria-pressed={active}
            aria-label={`${r.label}${n ? `, ${n}` : ""}`}
            disabled={pending}
            whileTap={reduce ? undefined : { scale: 0.85 }}
            onClick={() =>
              start(async () => {
                const next = active ? null : r.key;
                apply(next);
                await onSet(next);
              })
            }
            className={cn(
              "flex h-9 items-center gap-1 rounded-full border px-2.5 text-sm transition-colors",
              active ? "espresso border-transparent" : "border-ink/10 bg-white/70 hover:bg-white",
            )}
          >
            <motion.span animate={active && !reduce ? { scale: [1, 1.35, 1] } : { scale: 1 }} transition={{ duration: 0.35 }} aria-hidden>
              {r.emoji}
            </motion.span>
            {n > 0 ? <span className={cn("text-xs font-semibold tabular-nums", active ? "text-paper" : "text-muted")}>{n}</span> : null}
          </motion.button>
        );
      })}
      {!compact && total > 0 ? <span className="ml-1 text-xs text-muted">{total}</span> : null}
    </div>
  );
}
