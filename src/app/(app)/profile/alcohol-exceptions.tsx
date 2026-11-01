"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorText, Input } from "@/components/ui/field";
import { formatDateNl } from "@/lib/dates";
import { MAX_ALCOHOL_EXCEPTIONS } from "@/lib/constants";
import { addAlcoholException, removeAlcoholException } from "@/app/actions/profile";
import type { AlcoholException } from "@/lib/types";

export function AlcoholExceptions({ exceptions, min, max }: { exceptions: AlcoholException[]; min: string; max: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const full = exceptions.length >= MAX_ALCOHOL_EXCEPTIONS;
  return (
    <Card className="space-y-3">
      <p className="text-sm text-muted">
        Mik op een alcoholvrije winter, met maximaal {MAX_ALCOHOL_EXCEPTIONS} uitzonderingsmomenten. Alleen jij ziet dit.
      </p>
      {exceptions.length > 0 ? (
        <ul className="space-y-2">
          {exceptions.map((e) => (
            <li key={e.id} className="flex items-center justify-between rounded-xl bg-bg-2 px-3 py-2 text-sm">
              <span>🍷 {formatDateNl(e.exception_date)}</span>
              <form action={(fd) => start(async () => { const r = await removeAlcoholException(fd); if (!r.ok) setError(r.error); })}>
                <input type="hidden" name="id" value={e.id} />
                <button type="submit" className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:text-danger" aria-label="Verwijderen" disabled={pending}>
                  <X className="h-4 w-4" />
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : null}
      {!full ? (
        <form
          className="flex gap-2"
          action={(fd) => {
            setError(null);
            start(async () => {
              const r = await addAlcoholException(fd);
              if (!r.ok) setError(r.error);
            });
          }}
        >
          <Input type="date" name="exception_date" min={min} max={max} required aria-label="Datum uitzonderingsmoment" className="flex-1" />
          <Button type="submit" variant="secondary" loading={pending}>
            Toevoegen
          </Button>
        </form>
      ) : (
        <p className="text-xs text-muted">Je twee momenten staan vast. Geniet ervan, bewust.</p>
      )}
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}
