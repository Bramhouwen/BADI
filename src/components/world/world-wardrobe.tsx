"use client";

/**
 * The clothing rack in your own room: the outfits with your character in
 * them, what you wear now, and the gold one for the Super Badi of this week.
 */
import Image from "next/image";
import { Check, Lock, X } from "lucide-react";
import { OUTFITS, mayWear, spriteKey, type OutfitId } from "@/lib/world/outfits";
import { sheet } from "./world-hud";

export function WardrobeSheet({
  character,
  wearing,
  isSuperBadi,
  bottom,
  onWear,
  onClose,
}: {
  character: string;
  wearing: OutfitId;
  isSuperBadi: boolean;
  bottom: number | string;
  onWear: (outfit: OutfitId) => void;
  onClose: () => void;
}) {
  return (
    <section aria-label="Kledingrek" className={sheet} style={{ bottom }}>
      <header className="flex items-center gap-2 border-b border-ink/[0.06] px-4 py-3">
        <h2 className="text-[15px] font-semibold text-text">Kledingrek</h2>
        <button type="button" onClick={onClose} aria-label="Sluiten" className="ml-auto grid h-9 w-9 place-items-center rounded-full text-muted">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </header>
      <ul className="grid grid-cols-2 gap-3 p-3">
        {OUTFITS.map((o) => {
          const on = o.id === wearing;
          const allowed = mayWear(o.id, isSuperBadi);
          return (
            <li key={o.id}>
              <button
                type="button"
                disabled={on || !allowed}
                onClick={() => onWear(o.id)}
                aria-pressed={on}
                className={`flex w-full flex-col items-center gap-1 rounded-[18px] p-2 text-center ring-1 transition ${on ? "bg-[#f6ece4] ring-2 ring-[#2b1d18]" : "bg-white ring-ink/[0.08]"} ${allowed ? "" : "opacity-60"}`}
              >
                <Image src={`/wereld/poppetjes/${spriteKey(character, o.id)}/staan-01.png`} alt="" width={160} height={136} className="h-28 w-auto object-contain" />
                <span className="text-[13.5px] font-semibold leading-tight text-text">{o.name}</span>
                <span className="flex items-center gap-1 text-[12px] text-muted">
                  {on ? (
                    <>
                      <Check className="h-3.5 w-3.5" aria-hidden /> Aan
                    </>
                  ) : allowed ? (
                    "Aantrekken"
                  ) : (
                    <>
                      <Lock className="h-3.5 w-3.5" aria-hidden /> Alleen voor de Super Badi
                    </>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
