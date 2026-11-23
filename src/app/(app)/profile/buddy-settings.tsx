"use client";

import { readBuddyPrefs, useBuddyPrefs, writeBuddyPrefs, type BuddyPrefs } from "@/lib/buddy-prefs";
import { cn } from "@/lib/utils";

const ROWS: { key: keyof BuddyPrefs; label: string; hint: string }[] = [
  { key: "card", label: "Op Home", hint: "Je poppetje met nieuws, wat je haalde en hoe de squad het doet" },
  { key: "celebrate", label: "Meevieren", hint: "Confetti als je alles afvinkt, je stappendoel haalt of een training afrondt" },
  { key: "messages", label: "Berichten brengen", hint: "Een poppetje loopt binnen bij een privébericht of als je genoemd wordt" },
];

/** Switches for your character, per device. */
export function BuddySettings() {
  const prefs = useBuddyPrefs();
  return (
    <div className="glass rounded-[22px] px-4 py-1.5">
      <ul className="divide-y divide-ink/[0.06]">
        {ROWS.map((r) => (
          <li key={r.key}>
            <label className="flex cursor-pointer items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium text-text">{r.label}</span>
                <span className="block text-[11.5px] text-muted">{r.hint}</span>
              </span>
              <input
                type="checkbox"
                className="peer sr-only"
                checked={prefs[r.key]}
                onChange={() => {
                  const current = readBuddyPrefs();
                  writeBuddyPrefs({ ...current, [r.key]: !current[r.key] });
                }}
              />
              <span aria-hidden className={cn("relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-sage/60", prefs[r.key] ? "bg-sage" : "bg-ink/15")}>
                <span className={cn("absolute top-[3px] h-5 w-5 rounded-full bg-white shadow transition-all", prefs[r.key] ? "left-[21px]" : "left-[3px]")} />
              </span>
            </label>
          </li>
        ))}
      </ul>
      <p className="pb-2 pt-1 text-[11.5px] text-muted">Geldt voor dit toestel. Herinneringen krijg je van Baddy, niet van je poppetje.</p>
    </div>
  );
}
