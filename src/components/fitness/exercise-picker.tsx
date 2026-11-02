"use client";

import { useMemo, useState, useTransition } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ErrorText, Input, inputClass } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { MUSCLE_GROUPS, muscleLabel, type MuscleGroup } from "@/lib/fitness";
import type { ExerciseRow } from "@/lib/fitness/data";
import { createExercise, deleteExercise, updateExercise } from "@/app/actions/fitness";
import { cn } from "@/lib/utils";

export function ExercisePicker({
  open,
  onClose,
  exercises,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  exercises: ExerciseRow[];
  onPick: (exercise: ExerciseRow) => void;
}) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<MuscleGroup | "all">("all");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ExerciseRow | null>(null);
  const [name, setName] = useState("");
  const [muscle, setMuscle] = useState<MuscleGroup>("other");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [local, setLocal] = useState<ExerciseRow[]>(exercises);
  const toast = useToast();

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return local.filter((e) => (group === "all" || e.muscle_group === group) && (!q || e.name.toLowerCase().includes(q)));
  }, [local, query, group]);

  function openCreate() {
    setEditing(null);
    setName(query.trim());
    setMuscle(group === "all" ? "other" : group);
    setError(null);
    setCreating(true);
  }

  function openEdit(e: ExerciseRow) {
    setEditing(e);
    setName(e.name);
    setMuscle(e.muscle_group);
    setError(null);
    setCreating(true);
  }

  function submit() {
    start(async () => {
      if (editing) {
        const r = await updateExercise(editing.id, { name, muscle_group: muscle });
        if (!r.ok) return setError(r.error);
        setLocal((l) => l.map((x) => (x.id === editing.id ? { ...x, name: name.trim(), muscle_group: muscle } : x)));
      } else {
        const r = await createExercise({ name, muscle_group: muscle });
        if (!r.ok) return setError(r.error);
        const row: ExerciseRow = { id: r.data!.id, name: name.trim(), muscle_group: muscle, is_custom: true, owner_user_id: "me" };
        setLocal((l) => [...l, row].sort((a, b) => a.name.localeCompare(b.name)));
        onPick(row);
        onClose();
      }
      setCreating(false);
    });
  }

  function remove(e: ExerciseRow) {
    if (!confirm(`“${e.name}” verwijderen uit je oefeningen?`)) return;
    start(async () => {
      const r = await deleteExercise(e.id);
      if (!r.ok) return toast(r.error, "error");
      setLocal((l) => l.filter((x) => x.id !== e.id));
    });
  }

  return (
    <Sheet open={open} onClose={onClose} title="Oefening kiezen">
      {creating ? (
        <div className="space-y-3 pb-2">
          <p className="text-sm text-muted">{editing ? "Eigen oefening bewerken" : "Nieuwe eigen oefening"}</p>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Naam van de oefening" maxLength={60} autoFocus />
          <select value={muscle} onChange={(e) => setMuscle(e.target.value as MuscleGroup)} className={inputClass + " appearance-none"} aria-label="Spiergroep">
            {MUSCLE_GROUPS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
          <ErrorText>{error}</ErrorText>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={submit} loading={pending}>
              {editing ? "Opslaan" : "Toevoegen"}
            </Button>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Annuleren
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3 pb-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" strokeWidth={1.6} />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Zoek een oefening" className="pl-11" aria-label="Zoek een oefening" />
          </div>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" role="tablist" aria-label="Spiergroep">
            {[{ key: "all" as const, label: "Alles" }, ...MUSCLE_GROUPS].map((m) => (
              <button
                key={m.key}
                type="button"
                role="tab"
                aria-selected={group === m.key}
                onClick={() => setGroup(m.key as MuscleGroup | "all")}
                className={cn("shrink-0 rounded-full px-3 py-1.5 text-[12px] font-medium", group === m.key ? "espresso shadow-none" : "soft")}
              >
                {m.label}
              </button>
            ))}
          </div>
          <ul className="max-h-[46dvh] space-y-1.5 overflow-y-auto">
            {list.map((e) => (
              <li key={e.id} className="glass flex items-center gap-2 rounded-[16px] py-2 pl-3.5 pr-2">
                <button type="button" onClick={() => { onPick(e); onClose(); }} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-[14px] font-medium text-text">{e.name}</span>
                  <span className="block text-[11px] text-muted">
                    {muscleLabel(e.muscle_group)}
                    {e.is_custom ? " · eigen oefening" : ""}
                  </span>
                </button>
                {e.is_custom ? (
                  <>
                    <button type="button" onClick={() => openEdit(e)} className="soft flex h-8 w-8 items-center justify-center rounded-full" aria-label="Bewerken">
                      <Pencil className="h-3.5 w-3.5" strokeWidth={1.6} />
                    </button>
                    <button type="button" onClick={() => remove(e)} className="soft flex h-8 w-8 items-center justify-center rounded-full hover:text-danger" aria-label="Verwijderen">
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.6} />
                    </button>
                  </>
                ) : null}
              </li>
            ))}
            {list.length === 0 ? <li className="py-6 text-center text-sm text-muted">Geen oefening gevonden.</li> : null}
          </ul>
          <Button variant="secondary" className="w-full" onClick={openCreate}>
            <Plus className="h-4 w-4" strokeWidth={1.8} /> Eigen oefening toevoegen
          </Button>
        </div>
      )}
    </Sheet>
  );
}
