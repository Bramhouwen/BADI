"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Check, Plus, Sparkles, Trash2 } from "lucide-react";
import { addHabit, deleteHabit, moveHabit, toggleHabit, updateHabit } from "@/app/actions/habits";
import { MAX_HABITS, moveId, type Habit } from "@/lib/habits";
import { Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

interface Props {
  date: string;
  initialHabits: Habit[];
  /** Ticked dates per habit id, for the editable days. */
  initialLogs: Record<string, string[]>;
  shared: boolean;
}

const smallInput = "h-10 rounded-[12px] px-3 py-0 text-[14px]";

/** Own habits: ticked like the daily points, but outside the daily score and the streak. */
export function MyHabits({ date, initialHabits, initialLogs, shared }: Props) {
  const [habits, setHabits] = useState(initialHabits);
  const [logs, setLogs] = useState(initialLogs);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [, start] = useTransition();
  const [saving, startSave] = useTransition();
  const toast = useToast();

  function tick(id: string) {
    const on = !(logs[id] ?? []).includes(date);
    const before = logs;
    setLogs((l) => ({ ...l, [id]: on ? [...(l[id] ?? []), date] : (l[id] ?? []).filter((d) => d !== date) }));
    start(async () => {
      const r = await toggleHabit({ habitId: id, date, on });
      if (!r.ok) {
        setLogs(before);
        toast(r.error, "error");
      }
    });
  }

  function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    startSave(async () => {
      const r = await addHabit({ name: String(fd.get("name") ?? ""), emoji: String(fd.get("emoji") ?? "") });
      if (!r.ok) {
        toast(r.error, "error");
        return;
      }
      setHabits((h) => [...h, r.data!]);
      form.reset();
      setAdding(false);
    });
  }

  function rename(h: Habit, patch: { name?: string; emoji?: string }) {
    const name = patch.name ?? h.name;
    const emoji = patch.emoji ?? h.emoji ?? "";
    if (name.trim() === h.name && (emoji.trim() || null) === h.emoji) return;
    const before = habits;
    setHabits((list) => list.map((x) => (x.id === h.id ? { ...x, name: name.trim() || x.name, emoji: emoji.trim() || null } : x)));
    start(async () => {
      const r = await updateHabit(h.id, { name, emoji });
      if (!r.ok) {
        setHabits(before);
        toast(r.error, "error");
      }
    });
  }

  function move(id: string, direction: "up" | "down") {
    const before = habits;
    const order = moveId(habits.map((h) => h.id), id, direction);
    setHabits(order.map((x) => habits.find((h) => h.id === x)!));
    start(async () => {
      const r = await moveHabit(id, direction);
      if (!r.ok) {
        setHabits(before);
        toast(r.error, "error");
      }
    });
  }

  function remove(h: Habit) {
    if (!confirm(`"${h.name}" verwijderen? Je afgevinkte dagen van deze gewoonte verdwijnen ook.`)) return;
    const before = habits;
    setHabits((list) => list.filter((x) => x.id !== h.id));
    start(async () => {
      const r = await deleteHabit(h.id);
      if (!r.ok) {
        setHabits(before);
        toast(r.error, "error");
      }
    });
  }

  const canAdd = habits.length < MAX_HABITS;

  return (
    <section aria-label="Mijn gewoontes">
      <div className="mb-2.5 flex items-center justify-between px-0.5">
        <h2 className="font-display text-[19px]">Mijn gewoontes</h2>
        {habits.length > 0 ? (
          <button type="button" onClick={() => { setEditing((v) => !v); setAdding(false); }} className="text-[12.5px] font-medium text-muted hover:text-ink">
            {editing ? "Klaar" : "Aanpassen"}
          </button>
        ) : null}
      </div>

      {habits.length > 0 ? (
        <ul className="space-y-2">
          {habits.map((h, i) => {
            const done = (logs[h.id] ?? []).includes(date);
            if (editing) {
              return (
                <li key={h.id} className="glass flex items-center gap-2 rounded-[18px] p-2.5">
                  <Input defaultValue={h.emoji ?? ""} placeholder="🙂" aria-label={`Emoji van ${h.name}`} className={cn(smallInput, "w-12 shrink-0 px-0 text-center")} onBlur={(e) => rename(h, { emoji: e.target.value })} />
                  <Input defaultValue={h.name} maxLength={40} aria-label="Naam" className={cn(smallInput, "min-w-0 flex-1")} onBlur={(e) => rename(h, { name: e.target.value })} />
                  <button type="button" onClick={() => move(h.id, "up")} disabled={i === 0} className="soft flex h-8 w-8 shrink-0 items-center justify-center rounded-full disabled:opacity-30" aria-label={`${h.name} omhoog`}>
                    <ArrowUp className="h-3.5 w-3.5" strokeWidth={1.7} />
                  </button>
                  <button type="button" onClick={() => move(h.id, "down")} disabled={i === habits.length - 1} className="soft flex h-8 w-8 shrink-0 items-center justify-center rounded-full disabled:opacity-30" aria-label={`${h.name} omlaag`}>
                    <ArrowDown className="h-3.5 w-3.5" strokeWidth={1.7} />
                  </button>
                  <button type="button" onClick={() => remove(h)} className="soft flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:text-danger" aria-label={`${h.name} verwijderen`}>
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.7} />
                  </button>
                </li>
              );
            }
            return (
              <li key={h.id}>
                <button type="button" onClick={() => tick(h.id)} aria-pressed={done} className={cn("glass flex w-full items-center gap-3 rounded-[18px] py-2.5 pl-2.5 pr-3 text-left transition", done && "bg-sage/15")}>
                  <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[19px]", done ? "bg-sage text-white" : "soft")}>
                    {done ? <Check className="h-5 w-5" strokeWidth={2.2} /> : h.emoji ? <span aria-hidden>{h.emoji}</span> : <Sparkles className="h-5 w-5" strokeWidth={1.6} />}
                  </span>
                  <span className="min-w-0 truncate text-[14.5px] font-medium text-text">{h.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {adding ? (
        <form onSubmit={add} className="glass mt-2 flex items-center gap-2 rounded-[18px] p-2.5">
          <Input name="emoji" placeholder="🙂" aria-label="Emoji (optioneel)" className={cn(smallInput, "w-12 shrink-0 px-0 text-center")} />
          <Input name="name" placeholder="Bijvoorbeeld 10 minuten lezen" maxLength={40} required autoFocus aria-label="Naam van je gewoonte" className={cn(smallInput, "min-w-0 flex-1")} />
          <button type="submit" disabled={saving} className="espresso h-10 shrink-0 rounded-full px-3.5 text-[12.5px] font-medium shadow-none disabled:opacity-60">
            Toevoegen
          </button>
        </form>
      ) : canAdd && (editing || habits.length === 0) ? (
        <button type="button" onClick={() => setAdding(true)} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-[18px] border border-dashed border-ink/20 py-3 text-[13px] font-medium text-ink/80 hover:bg-white/50">
          <Plus className="h-4 w-4" strokeWidth={1.8} /> Eigen gewoonte toevoegen
        </button>
      ) : null}

      <p className="mt-2 px-0.5 text-[11.5px] leading-snug text-muted">
        Telt niet mee in je dagscore of streak. {shared ? "De squad ziet je gewoontes." : "Alleen jij ziet ze."}{" "}
        <Link href="/profile#zichtbaarheid" className="font-medium text-ink underline-offset-2 hover:underline">
          Zichtbaarheid
        </Link>
        {habits.length > 0 && !editing ? ` · maximaal ${MAX_HABITS}` : ""}
      </p>
    </section>
  );
}
