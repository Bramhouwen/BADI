"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Pencil, Repeat, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorText } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { deleteSession, repeatSession } from "@/app/actions/fitness";

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
export function StartChoice({ start: startTarget, after }: { start: StartTarget; after: StartTarget }) {
  const [pending, run] = useTransition();
  const toast = useToast();
  const pill = "inline-flex h-9 items-center justify-center rounded-full px-3 text-[12.5px] font-medium transition disabled:opacity-60";
  const styles = { start: `${pill} espresso shadow-none`, after: `${pill} border border-ink/10 bg-white text-ink shadow-sm hover:bg-blush` };
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
    <div className="flex shrink-0 gap-1.5 text-[12.5px] font-medium">
      {render(startTarget, "Start", styles.start)}
      {render(after, "Achteraf", styles.after)}
    </div>
  );
}
