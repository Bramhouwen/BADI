"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { claimPrize } from "@/app/actions/wheel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Claim a won prize; with variants (size, flavour, colour) the winner picks one first. */
export function ClaimForm({ spinId, variantLabel, variants, onClaimed }: { spinId: string; variantLabel: string | null; variants: string[]; onClaimed?: () => void }) {
  const [variant, setVariant] = useState<string | null>(variants.length === 1 ? variants[0] : null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  if (done) {
    return (
      <p className="flex items-center justify-center gap-1.5 rounded-full bg-sage/20 px-4 py-3 text-[13.5px] font-medium text-ink" role="status">
        <Check className="h-4 w-4" strokeWidth={2.2} aria-hidden />
        Geclaimd{variant ? ` (${variant})` : ""}. Status volg je in je prijzenkast.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {variants.length > 0 ? (
        <fieldset>
          <legend className="mb-2 text-[12.5px] font-medium text-muted">Kies je {(variantLabel ?? "optie").toLowerCase()}</legend>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVariant(v)}
                aria-pressed={variant === v}
                className={cn("h-10 rounded-full px-4 text-[13px] font-medium ring-1 transition-colors", variant === v ? "espresso ring-transparent" : "bg-white text-ink ring-ink/15 hover:bg-blush")}
              >
                {v}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}
      {error ? (
        <p className="text-[12.5px] text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        className="w-full"
        size="lg"
        loading={pending}
        disabled={variants.length > 0 && !variant}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await claimPrize(spinId, variant);
            if (!res.ok) setError(res.error);
            else {
              setDone(true);
              onClaimed?.();
            }
          })
        }
      >
        Claim mijn prijs
      </Button>
    </div>
  );
}
