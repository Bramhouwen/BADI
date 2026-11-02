"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Pencil, Repeat, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorText } from "@/components/ui/field";
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

export function StartStrengthButton({ action, label, variant = "primary" }: { action: () => Promise<{ ok: boolean; error?: string } | void>; label: string; variant?: "primary" | "secondary" }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <Button
        variant={variant}
        size="sm"
        className="w-full"
        loading={pending}
        onClick={() =>
          start(async () => {
            const r = await action();
            if (r && !r.ok) setError(r.error ?? "Er ging iets mis.");
          })
        }
      >
        {label}
      </Button>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
