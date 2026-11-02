"use client";

import { useState } from "react";
import { EMOJI_GROUPS } from "@/lib/conversations";
import { cn } from "@/lib/utils";

/** Compact emoji panel with a few themed groups; used in the composer and for reactions. */
export function EmojiPicker({ onPick, className }: { onPick: (emoji: string) => void; className?: string }) {
  const [group, setGroup] = useState(0);
  return (
    <div className={cn("rounded-[20px] bg-white/95 p-2 shadow-[0_18px_40px_-20px_rgba(95,53,41,0.55)] ring-1 ring-ink/[0.06] backdrop-blur", className)}>
      <div className="no-scrollbar mb-1.5 flex gap-1 overflow-x-auto text-[12px] font-medium" role="tablist" aria-label="Emoji-groepen">
        {EMOJI_GROUPS.map((g, i) => (
          <button
            key={g.label}
            type="button"
            role="tab"
            aria-selected={group === i}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setGroup(i)}
            className={cn("shrink-0 rounded-full px-3 py-1", group === i ? "bg-ink" : "hover:bg-blush")}
          >
            <span className={cn("text-[12px] font-medium", group === i ? "text-paper" : "text-ink/70")}>{g.label}</span>
          </button>
        ))}
      </div>
      <div className="grid max-h-44 grid-cols-8 gap-0.5 overflow-y-auto" role="listbox" aria-label={EMOJI_GROUPS[group].label}>
        {EMOJI_GROUPS[group].emoji.map((e) => (
          <button
            key={e}
            type="button"
            role="option"
            aria-selected={false}
            aria-label={e}
            onMouseDown={(ev) => ev.preventDefault()}
            onClick={() => onPick(e)}
            className="flex h-10 items-center justify-center rounded-xl hover:bg-blush active:scale-90"
          >
            <span className="text-[24px] leading-none">{e}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
