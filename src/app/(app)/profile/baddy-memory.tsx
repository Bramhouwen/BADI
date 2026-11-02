"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ErrorText } from "@/components/ui/field";
import { addCoachMemory, deleteCoachMemory } from "@/app/actions/coach";

interface Memory {
  id: string;
  content: string;
  source: "coach" | "member";
}

/** What Baddy remembers about you: visible, editable, deletable. */
export function BaddyMemory({ initial }: { initial: Memory[] }) {
  const [items, setItems] = useState<Memory[]>(initial);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const content = draft.trim();
    if (!content) return;
    setError(null);
    start(async () => {
      const r = await addCoachMemory(content);
      if (!r.ok) setError(r.error);
      else {
        setItems((l) => [...l, { ...r.data!, source: "member" }]);
        setDraft("");
      }
    });
  }

  function remove(id: string) {
    const backup = items;
    setItems((l) => l.filter((m) => m.id !== id));
    start(async () => {
      const r = await deleteCoachMemory(id);
      if (!r.ok) {
        setItems(backup);
        setError(r.error);
      }
    });
  }

  return (
    <Card className="space-y-3">
      {items.length === 0 ? (
        <p className="text-[13px] leading-snug text-muted">Baddy weet nog niets over je. Vertel haar in het gesprek over je voorkeuren, doelen of blessures, of voeg hier zelf iets toe.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((m) => (
            <li key={m.id} className="flex items-start gap-2 rounded-[14px] bg-blush/60 py-2 pl-3 pr-1.5">
              <span className="min-w-0 flex-1 text-[13.5px] leading-snug text-text">
                {m.content}
                <span className="ml-1.5 text-[11px] text-muted">{m.source === "coach" ? "door Baddy" : "door jou"}</span>
              </span>
              <button type="button" onClick={() => remove(m.id)} disabled={pending} aria-label={`Vergeet: ${m.content}`} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted hover:bg-white hover:text-ink">
                <X className="h-4 w-4" strokeWidth={1.7} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="flex items-center gap-1.5 rounded-full bg-white p-1 pl-4 ring-1 ring-ink/[0.06]">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={200}
          placeholder="Bijvoorbeeld: ik eet geen vis"
          aria-label="Nieuwe notitie voor Baddy"
          className="min-w-0 flex-1 bg-transparent py-2 text-[14px] outline-none placeholder:text-muted"
        />
        <button type="submit" disabled={!draft.trim() || pending} aria-label="Notitie toevoegen" className="espresso flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-none disabled:opacity-40">
          <Plus className="h-4 w-4" strokeWidth={2} />
        </button>
      </form>
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}
