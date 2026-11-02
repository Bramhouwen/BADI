"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Pencil, Repeat, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorText } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { deleteSession, discardDraft, repeatSession } from "@/app/actions/fitness";
import { cn } from "@/lib/utils";

export function SessionActions({ id, editHref }: { id: string; editHref: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="primary"
          onClick={() =>
            start(async () => {
              const r = await repeatSession(id);
              if (r && !r.ok) setError(r.error);
            })
          }
          loading={pending}
        >
          <Repeat className="h-4 w-4" strokeWidth={1.7} /> Herhaal training
        </Button>
        <Link href={editHref} className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-ink/10 bg-white text-[14px] font-medium text-ink shadow-sm hover:bg-blush">
          <Pencil className="h-4 w-4" strokeWidth={1.7} /> Bewerken
        </Link>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm("Training verwijderen? Dit kan niet ongedaan worden gemaakt. Je statistieken en check-in worden opnieuw berekend.")) return;
          start(async () => {
            const r = await deleteSession(id);
            if (r && !r.ok) setError(r.error);
          });
        }}
        className="mx-auto flex items-center gap-1.5 text-xs text-muted hover:text-danger"
      >
        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.7} /> Training verwijderen
      </button>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

type StartTarget = string | (() => Promise<{ ok: boolean; error?: string } | void>);

/** Compact pair: start live (with timer) or log a finished workout afterwards. A target is a link or a server action. */
export function StartChoice({ start: startTarget, after, size = "sm" }: { start: StartTarget; after: StartTarget; size?: "sm" | "lg" }) {
  const [pending, run] = useTransition();
  const toast = useToast();
  const pill = size === "lg" ? "inline-flex h-12 flex-1 items-center justify-center rounded-full px-4 font-medium transition disabled:opacity-60" : "inline-flex h-9 items-center justify-center rounded-full px-3 text-[12.5px] font-medium transition disabled:opacity-60";
  const styles = { start: `${pill} espresso shadow-none`, after: `${pill} border border-ink/10 bg-white text-ink shadow-sm hover:bg-blush` };
  const labels = size === "lg" ? ["Start training", "Achteraf invullen"] : ["Start", "Achteraf"];
  const render = (target: StartTarget, label: string, cls: string) =>
    typeof target === "string" ? (
      <Link href={target} className={cls}>
        {label}
      </Link>
    ) : (
      <button
        type="button"
        disabled={pending}
        className={cls}
        onClick={() =>
          run(async () => {
            const r = await target();
            if (r && !r.ok) toast(r.error ?? "Er ging iets mis.", "error");
          })
        }
      >
        {label}
      </button>
    );
  return (
    // Buttons inherit font from their parent (globals.css), so the size sits on the wrapper.
    <div className={size === "lg" ? "flex w-full gap-2 text-[14px] font-medium" : "flex shrink-0 gap-1.5 text-[12.5px] font-medium"}>
      {render(startTarget, labels[0], styles.start)}
      {render(after, labels[1], styles.after)}
    </div>
  );
}

/**
 * Throws away an unfinished workout after a confirm. "icon" is the round trash button on draft cards,
 * "text" the quiet link under the logger. onDone runs before navigating, e.g. to clear a local timer.
 */
export function DiscardDraftButton({ id, variant = "icon", onDone, className }: { id: string; variant?: "icon" | "text"; onDone?: () => void; className?: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  function discard() {
    if (!confirm("Deze training verwijderen? Wat je hebt ingevuld gaat verloren.")) return;
    start(async () => {
      const r = await discardDraft(id);
      if (!r.ok) return toast(r.error, "error");
      onDone?.();
      toast("Training verwijderd", "success");
      router.push("/fitness");
      router.refresh();
    });
  }
  return variant === "icon" ? (
    <button type="button" onClick={discard} disabled={pending} aria-label="Training verwijderen" className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-muted shadow-sm ring-1 ring-ink/[0.06] hover:text-danger disabled:opacity-50", className)}>
      <Trash2 className="h-4 w-4" strokeWidth={1.7} />
    </button>
  ) : (
    <button type="button" onClick={discard} disabled={pending} className={cn("mx-auto flex items-center gap-1.5 text-muted hover:text-danger disabled:opacity-50", className)}>
      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.7} />
      <span className="text-[12.5px]">Training verwijderen</span>
    </button>
  );
}
