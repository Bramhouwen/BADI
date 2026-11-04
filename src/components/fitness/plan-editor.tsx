"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ExerciseDemoButton } from "./exercise-demo";
import { ArrowDown, ArrowUp, Copy, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorText, Input, Label, Textarea, inputClass } from "@/components/ui/field";
import { IconBadge } from "@/components/ui/icon-badge";
import { useToast } from "@/components/ui/toast";
import { ACTIVITY_TYPES, activityMeta, decimalText, formatKg, muscleLabel, parseDecimal, type ActivityType } from "@/lib/fitness";
import type { ExerciseRow, PlanDetail, TemplateRow } from "@/lib/fitness/data";
import {
  addTemplate,
  addTemplateExercise,
  deletePlan,
  deleteTemplate,
  duplicatePlan,
  moveTemplate,
  moveTemplateExercise,
  removeTemplateExercise,
  updatePlan,
  updateTemplate,
  updateTemplateExercise,
} from "@/app/actions/fitness";
import { ExercisePicker } from "./exercise-picker";

export function PlanEditor({ plan, exercises }: { plan: PlanDetail; exercises: ExerciseRow[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingMeta, setEditingMeta] = useState(false);
  const [newTemplate, setNewTemplate] = useState(false);
  const [tName, setTName] = useState("");
  const [tType, setTType] = useState<ActivityType>("strength");
  const toast = useToast();

  const run = (fn: () => Promise<{ ok: boolean; error?: string } | void>, done?: string) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r && !r.ok) setError(r.error ?? "Er ging iets mis.");
      else if (done) toast(done, "success");
    });

  return (
    <div className="space-y-5">
      <Card className="space-y-2">
        {editingMeta ? (
          <form
            className="space-y-3"
            action={(fd) =>
              run(async () => {
                const r = await updatePlan(plan.id, fd);
                if (r.ok) setEditingMeta(false);
                return r;
              }, "Schema opgeslagen")
            }
          >
            <div>
              <Label htmlFor="name">Naam</Label>
              <Input id="name" name="name" defaultValue={plan.name} maxLength={60} required />
            </div>
            <div>
              <Label htmlFor="goal">Doel (optioneel)</Label>
              <Input id="goal" name="goal" defaultValue={plan.goal ?? ""} maxLength={120} placeholder="Bijv. sterker worden in squat" />
            </div>
            <div>
              <Label htmlFor="description">Beschrijving (optioneel)</Label>
              <Textarea id="description" name="description" defaultValue={plan.description ?? ""} maxLength={500} className="min-h-[64px]" />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" loading={pending}>
                Opslaan
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditingMeta(false)}>
                Annuleren
              </Button>
            </div>
          </form>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-display text-[22px] leading-tight text-text">{plan.name}</h2>
                {plan.goal ? <p className="mt-0.5 text-[12.5px] text-ink">{plan.goal}</p> : null}
                {plan.description ? <p className="mt-1 text-[12.5px] text-muted">{plan.description}</p> : null}
              </div>
              <button type="button" onClick={() => setEditingMeta(true)} className="soft flex h-9 w-9 shrink-0 items-center justify-center rounded-full" aria-label="Schema bewerken">
                <Pencil className="h-4 w-4" strokeWidth={1.6} />
              </button>
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="secondary" onClick={() => run(() => duplicatePlan(plan.id))} loading={pending}>
                <Copy className="h-4 w-4" strokeWidth={1.7} /> Dupliceren
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (!confirm("Schema verwijderen? Je eerdere trainingen blijven bewaard.")) return;
                  run(() => deletePlan(plan.id));
                }}
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.7} /> Verwijderen
              </Button>
            </div>
          </>
        )}
      </Card>

      <div className="space-y-3">
        {plan.templates.map((t, i) => (
          <TemplateCard key={t.id} template={t} planId={plan.id} index={i} count={plan.templates.length} exercises={exercises} run={run} pending={pending} />
        ))}
      </div>

      {newTemplate ? (
        <Card className="space-y-3">
          <p className="text-[14px] font-medium text-text">Nieuwe workout in dit schema</p>
          <Input value={tName} onChange={(e) => setTName(e.target.value)} placeholder="Bijv. Lower body" maxLength={60} autoFocus />
          <select value={tType} onChange={(e) => setTType(e.target.value as ActivityType)} className={inputClass + " appearance-none"} aria-label="Type">
            {ACTIVITY_TYPES.map((a) => (
              <option key={a.key} value={a.key}>
                {a.label}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <Button
              size="sm"
              loading={pending}
              onClick={() =>
                run(async () => {
                  const r = await addTemplate(plan.id, { name: tName, activity_type: tType });
                  if (r.ok) {
                    setNewTemplate(false);
                    setTName("");
                  }
                  return r;
                })
              }
            >
              Toevoegen
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setNewTemplate(false)}>
              Annuleren
            </Button>
          </div>
        </Card>
      ) : (
        <Button variant="secondary" className="w-full" onClick={() => setNewTemplate(true)}>
          <Plus className="h-4 w-4" strokeWidth={1.8} /> Workout toevoegen
        </Button>
      )}
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

function TemplateCard({
  template,
  planId,
  index,
  count,
  exercises,
  run,
  pending,
}: {
  template: TemplateRow;
  planId: string;
  index: number;
  count: number;
  exercises: ExerciseRow[];
  run: (fn: () => Promise<{ ok: boolean; error?: string } | void>, done?: string) => void;
  pending: boolean;
}) {
  const meta = activityMeta(template.activity_type);
  const [picker, setPicker] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(template.name);
  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-3">
        <IconBadge icon={meta.icon} size="sm" />
        <div className="min-w-0 flex-1">
          {renaming ? (
            <div className="flex gap-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="h-10 py-0" />
              <Button size="sm" onClick={() => run(async () => { const r = await updateTemplate(template.id, { name }); if (r.ok) setRenaming(false); return r; })} loading={pending}>
                OK
              </Button>
            </div>
          ) : (
            <>
              <p className="truncate text-[15px] font-medium text-text">{template.name}</p>
              <p className="text-[11px] text-muted">
                {meta.label} · {template.exercises.length} {template.exercises.length === 1 ? "oefening" : "oefeningen"}
              </p>
            </>
          )}
        </div>
        <button type="button" onClick={() => setRenaming((r) => !r)} className="soft flex h-8 w-8 items-center justify-center rounded-full" aria-label="Naam wijzigen">
          <Pencil className="h-3.5 w-3.5" strokeWidth={1.6} />
        </button>
        <button type="button" disabled={index === 0} onClick={() => run(() => moveTemplate(planId, template.id, "up"))} className="soft flex h-8 w-8 items-center justify-center rounded-full disabled:opacity-30" aria-label="Omhoog">
          <ArrowUp className="h-3.5 w-3.5" strokeWidth={1.6} />
        </button>
        <button type="button" disabled={index === count - 1} onClick={() => run(() => moveTemplate(planId, template.id, "down"))} className="soft flex h-8 w-8 items-center justify-center rounded-full disabled:opacity-30" aria-label="Omlaag">
          <ArrowDown className="h-3.5 w-3.5" strokeWidth={1.6} />
        </button>
        <button
          type="button"
          onClick={() => {
            if (!confirm(`Workout “${template.name}” verwijderen?`)) return;
            run(() => deleteTemplate(template.id));
          }}
          className="soft flex h-8 w-8 items-center justify-center rounded-full hover:text-danger"
          aria-label="Workout verwijderen"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.6} />
        </button>
      </div>

      {template.activity_type === "strength" ? (
        <ul className="space-y-1.5">
          {template.exercises.map((e, i) => (
            <TemplateExerciseRowView key={e.id} row={e} index={i} count={template.exercises.length} templateId={template.id} run={run} />
          ))}
          {template.exercises.length === 0 ? <li className="text-[12px] text-muted">Nog geen oefeningen. Voeg er een toe.</li> : null}
        </ul>
      ) : (
        <p className="text-[12px] text-muted">Cardio-workout: bij het starten vul je duur en afstand in.</p>
      )}

      <div className="flex gap-2">
        {template.activity_type === "strength" ? (
          <Button size="sm" variant="secondary" onClick={() => setPicker(true)}>
            <Plus className="h-4 w-4" strokeWidth={1.7} /> Oefening
          </Button>
        ) : null}
        <Link href={`/fitness/workouts/${template.id}`} className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full border border-ink/10 bg-white text-[13px] font-medium text-ink shadow-sm hover:bg-blush">
          <Play className="h-4 w-4" strokeWidth={1.7} /> Bekijk workout
        </Link>
      </div>
      <ExercisePicker open={picker} onClose={() => setPicker(false)} exercises={exercises} onPick={(e) => run(() => addTemplateExercise(template.id, { exercise_id: e.id, target_sets: 3, target_reps: 10, target_weight_kg: null }))} />
    </Card>
  );
}

function TemplateExerciseRowView({ row, index, count, templateId, run }: { row: TemplateRow["exercises"][number]; index: number; count: number; templateId: string; run: (fn: () => Promise<{ ok: boolean; error?: string } | void>, done?: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [sets, setSets] = useState(row.target_sets);
  const [reps, setReps] = useState<string>(row.target_reps?.toString() ?? "");
  const [weight, setWeight] = useState<string>(decimalText(row.target_weight_kg));
  return (
    <li className="rounded-[14px] bg-blush/60 px-3 py-2">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-medium text-text">{row.name}</p>
          <p className="text-[11px] text-muted">
            {muscleLabel(row.muscle_group)} · {row.target_sets} × {row.target_reps ?? "–"}
            {row.target_weight_kg !== null ? ` · ${formatKg(row.target_weight_kg)}` : ""}
          </p>
        </div>
        <ExerciseDemoButton name={row.name} subtitle={muscleLabel(row.muscle_group)} className="bg-white/80" />
        <button type="button" onClick={() => setEditing((e) => !e)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/80" aria-label="Doelen aanpassen">
          <Pencil className="h-3.5 w-3.5" strokeWidth={1.6} />
        </button>
        <button type="button" disabled={index === 0} onClick={() => run(() => moveTemplateExercise(templateId, row.id, "up"))} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/80 disabled:opacity-30" aria-label="Omhoog">
          <ArrowUp className="h-3.5 w-3.5" strokeWidth={1.6} />
        </button>
        <button type="button" disabled={index === count - 1} onClick={() => run(() => moveTemplateExercise(templateId, row.id, "down"))} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/80 disabled:opacity-30" aria-label="Omlaag">
          <ArrowDown className="h-3.5 w-3.5" strokeWidth={1.6} />
        </button>
        <button type="button" onClick={() => run(() => removeTemplateExercise(row.id))} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/80 hover:text-danger" aria-label="Verwijderen">
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.6} />
        </button>
      </div>
      {editing ? (
        <div className="mt-2 grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2">
          <div>
            <Label className="mb-1 text-[11px]">Sets</Label>
            <Input type="number" min={1} max={20} value={sets} onChange={(e) => setSets(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} className="h-10 py-0 text-center" />
          </div>
          <div>
            <Label className="mb-1 text-[11px]">Herh.</Label>
            <Input type="number" min={1} max={500} value={reps} onChange={(e) => setReps(e.target.value)} className="h-10 py-0 text-center" placeholder="–" />
          </div>
          <div>
            <Label className="mb-1 text-[11px]">kg</Label>
            <Input type="text" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} className="h-10 py-0 text-center" placeholder="–" />
          </div>
          <Button
            size="sm"
            onClick={() =>
              run(async () => {
                const r = await updateTemplateExercise(row.id, {
                  target_sets: sets,
                  target_reps: reps === "" ? null : Math.round(Number(reps)),
                  target_weight_kg: parseDecimal(weight),
                });
                if (r.ok) setEditing(false);
                return r;
              })
            }
          >
            OK
          </Button>
        </div>
      ) : null}
    </li>
  );
}
