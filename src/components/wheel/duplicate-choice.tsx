"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";
import { respinWheel, swapPrize, type PrizeChoice } from "@/app/actions/wheel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * A prize you already have: spin again, or pick another prize in the same
 * level that you do not have yet. `onRespin` lets the wheel animate the new
 * spin; without it the new result shows up in the prize cabinet.
 */
export function DuplicateChoice({ spinId, alternatives, onRespin, dark = false }: { spinId: string; alternatives: PrizeChoice[]; onRespin?: () => void; dark?: boolean }) {
  const router = useRouter();
  const [pick, setPick] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const respin = () => {
    if (onRespin) return onRespin();
    start(async () => {
      setError(null);
      const res = await respinWheel(spinId);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  };

  return (
    <div className={cn("space-y-3 rounded-[18px] p-3.5 text-left", dark ? "bg-[#fbf7f2] text-text" : "bg-gold/15")}>
      <p className="text-[13.5px] font-semibold text-text">Deze heb je al gewonnen.</p>
      <p className="-mt-2 text-[12.5px] leading-snug text-muted">Draai opnieuw, of kies iets anders uit dezelfde categorie.</p>
      <Button type="button" variant="secondary" size="sm" className="w-full" disabled={pending} onClick={respin}>
        <RotateCw className="h-4 w-4" strokeWidth={1.8} aria-hidden /> Opnieuw draaien
      </Button>
      {alternatives.length > 0 ? (
        <fieldset className="space-y-1.5">
          <legend className="mb-1.5 text-[12.5px] font-medium text-muted">Of kies iets anders</legend>
          {alternatives.map((a) => (
            <label key={a.id} className={cn("flex cursor-pointer items-center gap-2.5 rounded-[12px] bg-white px-3 py-2.5 text-[13.5px] ring-1", pick === a.id ? "ring-2 ring-ink" : "ring-ink/10")}>
              <input type="radio" name={`swap-${spinId}`} value={a.id} checked={pick === a.id} onChange={() => setPick(a.id)} className="accent-[#6e4034]" />
              <span>
                <span className="font-medium">{a.brand}</span> {a.name}
              </span>
            </label>
          ))}
          <Button
            type="button"
            size="sm"
            className="w-full"
            disabled={!pick}
            loading={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                const res = await swapPrize(spinId, pick!);
                if (!res.ok) setError(res.error);
                else router.push("/wheel/prizes");
              })
            }
          >
            Kies deze
          </Button>
        </fieldset>
      ) : null}
      {error ? (
        <p className="text-[12.5px] text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
