"use client";

import { useState, useTransition } from "react";
import { Milk, Plus, X } from "lucide-react";
import { addWaterBottle, deleteWaterBottle } from "@/app/actions/water";
import { ErrorText } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export interface WaterBottle {
  id: string;
  name: string;
  amount_ml: number;
}

/** Saved bottles with an exact size; one tap adds the bottle to today's water. */
export function MyBottles({ initial, onAdd, disabled }: { initial: WaterBottle[]; onAdd: (ml: number) => void; disabled?: boolean }) {
  const [bottles, setBottles] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [ml, setMl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();

  function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await addWaterBottle({ name, amount_ml: ml });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setBottles((b) => [...b, r.data!]);
      setName("");
      setMl("");
      setAdding(false);
      toast(`${r.data!.name} opgeslagen`, "success");
    });
  }

  function remove(id: string) {
    const before = bottles;
    setBottles((b) => b.filter((x) => x.id !== id));
    start(async () => {
      const r = await deleteWaterBottle(id);
      if (!r.ok) {
        setBottles(before);
        toast(r.error, "error");
      }
    });
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-[13px] font-medium text-muted">Mijn flessen</p>
        {bottles.length > 0 ? (
          <button type="button" onClick={() => setEditing((v) => !v)} className="text-[12.5px] font-medium text-muted hover:text-ink">
            {editing ? "Klaar" : "Bewerken"}
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {bottles.map((b) => (
          <div key={b.id} className="relative">
            <button
              type="button"
              disabled={disabled || editing}
              onClick={() => onAdd(b.amount_ml)}
              className="glass flex w-full items-center gap-3 rounded-full py-2 pl-2 pr-4 text-left transition active:scale-[0.98] disabled:opacity-70"
            >
              <span className="soft flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
                <Milk className="h-4 w-4" strokeWidth={1.6} />
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] font-medium tabular-nums text-text">{b.amount_ml} ml</span>
                <span className="block truncate text-[12px] text-muted">{b.name}</span>
              </span>
            </button>
            {editing ? (
              <button type="button" onClick={() => remove(b.id)} aria-label={`Verwijder ${b.name}`} className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-white text-ink shadow-md">
                <X className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            ) : null}
          </div>
        ))}
        {!adding && bottles.length < 6 ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className={cn("flex items-center gap-3 rounded-full border border-dashed border-ink/20 py-2 pl-2 pr-4 text-left text-ink/80 hover:bg-white/50", bottles.length === 0 && "col-span-2")}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/70">
              <Plus className="h-4 w-4" strokeWidth={1.8} />
            </span>
            <span className="text-[13.5px] font-medium">Eigen fles toevoegen</span>
          </button>
        ) : null}
      </div>

      {adding ? (
        <form onSubmit={save} className="glass mt-3 space-y-2.5 rounded-[20px] p-3">
          <div className="grid grid-cols-[1fr_110px] gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
              placeholder="Naam, bijv. Literfles"
              aria-label="Naam van de fles"
              autoFocus
              className="rounded-full bg-white px-4 py-2.5 text-[14px] outline-none ring-1 ring-ink/[0.08] placeholder:text-muted"
            />
            <div className="flex items-center rounded-full bg-white pr-3 ring-1 ring-ink/[0.08]">
              <input
                value={ml}
                onChange={(e) => setMl(e.target.value.replace(/[^0-9]/g, ""))}
                inputMode="numeric"
                placeholder="870"
                aria-label="Inhoud in milliliter"
                className="w-full min-w-0 rounded-full bg-transparent py-2.5 pl-4 text-[14px] tabular-nums outline-none placeholder:text-muted"
              />
              <span className="text-[13px] text-muted">ml</span>
            </div>
          </div>
          <ErrorText>{error}</ErrorText>
          <div className="flex gap-2">
            <button type="submit" disabled={pending || !name.trim() || !ml} className="espresso flex-1 rounded-full py-2.5 text-[13.5px] font-medium shadow-none disabled:opacity-50">
              Opslaan
            </button>
            <button type="button" onClick={() => setAdding(false)} className="rounded-full bg-white px-4 py-2.5 text-[13.5px] font-medium text-ink">
              Annuleren
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
