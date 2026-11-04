import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AppContext } from "@/lib/data";
import type { ActivityType, ExerciseMeasure, MuscleGroup, StrengthInput } from "@/lib/fitness";

export interface ExerciseRow {
  id: string;
  name: string;
  muscle_group: MuscleGroup;
  measure: ExerciseMeasure;
  is_custom: boolean;
  owner_user_id: string | null;
}

export interface SessionRow {
  id: string;
  user_id: string;
  template_id: string | null;
  activity_type: ActivityType;
  title: string;
  workout_date: string;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  distance_meters: number | null;
  notes: string | null;
  status: "draft" | "completed";
  created_at: string;
}

export interface SetRow {
  id: string;
  workout_exercise_id: string;
  set_number: number;
  weight_kg: number | null;
  repetitions: number | null;
  duration_seconds: number | null;
  completed: boolean;
}

export interface SessionExercise {
  id: string;
  exercise_id: string;
  name: string;
  muscle_group: MuscleGroup;
  measure: ExerciseMeasure;
  sort_order: number;
  notes: string | null;
  sets: SetRow[];
}

export interface SessionDetail extends SessionRow {
  exercises: SessionExercise[];
}

export async function loadExercises(ctx: AppContext): Promise<ExerciseRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("exercises")
    .select("id, name, muscle_group, measure, is_custom, owner_user_id")
    .or(`owner_user_id.is.null,owner_user_id.eq.${ctx.userId}`)
    .order("name", { ascending: true });
  return (data ?? []) as ExerciseRow[];
}

export async function loadSessions(ctx: AppContext, opts: { status?: "completed" | "draft"; type?: ActivityType; limit?: number } = {}): Promise<SessionRow[]> {
  const supabase = await createClient();
  let q = supabase.from("workout_sessions").select("*").eq("user_id", ctx.userId).order("workout_date", { ascending: false }).order("created_at", { ascending: false });
  if (opts.status) q = q.eq("status", opts.status);
  if (opts.type) q = q.eq("activity_type", opts.type);
  if (opts.limit) q = q.limit(opts.limit);
  const { data } = await q;
  return (data ?? []) as SessionRow[];
}

async function attachExercises(sessions: SessionRow[]): Promise<SessionDetail[]> {
  if (sessions.length === 0) return [];
  const supabase = await createClient();
  const ids = sessions.map((s) => s.id);
  const { data: weRows } = await supabase.from("workout_exercises").select("id, session_id, exercise_id, sort_order, notes").in("session_id", ids).order("sort_order", { ascending: true });
  const wes = (weRows ?? []) as { id: string; session_id: string; exercise_id: string; sort_order: number; notes: string | null }[];
  const weIds = wes.map((w) => w.id);
  const exIds = [...new Set(wes.map((w) => w.exercise_id))];
  const { data: setRows } = weIds.length ? await supabase.from("exercise_sets").select("*").in("workout_exercise_id", weIds).order("set_number", { ascending: true }) : { data: [] };
  const { data: exRows } = exIds.length ? await supabase.from("exercises").select("id, name, muscle_group, measure").in("id", exIds) : { data: [] };
  const sets = (setRows ?? []) as SetRow[];
  const exMap = new Map(((exRows ?? []) as Pick<ExerciseRow, "id" | "name" | "muscle_group" | "measure">[]).map((e) => [e.id, e]));
  return sessions.map((s) => ({
    ...s,
    exercises: wes
      .filter((w) => w.session_id === s.id)
      .map((w) => ({
        id: w.id,
        exercise_id: w.exercise_id,
        name: exMap.get(w.exercise_id)?.name ?? "Oefening",
        muscle_group: exMap.get(w.exercise_id)?.muscle_group ?? "other",
        measure: exMap.get(w.exercise_id)?.measure ?? "reps",
        sort_order: w.sort_order,
        notes: w.notes,
        sets: sets.filter((x) => x.workout_exercise_id === w.id).map((x) => ({ ...x, weight_kg: x.weight_kg === null ? null : Number(x.weight_kg), duration_seconds: x.duration_seconds ?? null })),
      })),
  }));
}

export async function loadSessionDetail(ctx: AppContext, id: string): Promise<SessionDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("workout_sessions").select("*").eq("id", id).eq("user_id", ctx.userId).maybeSingle();
  if (!data) return null;
  const [detail] = await attachExercises([data as SessionRow]);
  return detail ?? null;
}

/** All completed strength sessions with their sets, newest first, for records and progress. */
export async function loadStrengthHistory(ctx: AppContext): Promise<{ sessions: SessionDetail[]; rows: StrengthInput[] }> {
  const sessions = await loadSessions(ctx, { status: "completed", type: "strength" });
  const details = await attachExercises(sessions);
  const rows: StrengthInput[] = [];
  for (const s of details) for (const e of s.exercises) rows.push({ sessionId: s.id, date: s.workout_date, exerciseId: e.exercise_id, name: e.name, sets: e.sets });
  return { sessions: details, rows };
}

export type LastPerformance = Record<string, { date: string; sets: { weight_kg: number | null; repetitions: number | null; duration_seconds: number | null }[] }>;

/** The most recent completed sets of each exercise. */
export async function loadLastPerformance(ctx: AppContext): Promise<LastPerformance> {
  const { sessions } = await loadStrengthHistory(ctx);
  const out: LastPerformance = {};
  for (const s of sessions) {
    for (const e of s.exercises) {
      if (out[e.exercise_id]) continue; // newest first
      const done = e.sets.filter((x) => x.completed);
      if (done.length === 0) continue;
      out[e.exercise_id] = { date: s.workout_date, sets: done.map((x) => ({ weight_kg: x.weight_kg, repetitions: x.repetitions, duration_seconds: x.duration_seconds })) };
    }
  }
  return out;
}

export interface PlanRow {
  id: string;
  name: string;
  description: string | null;
  goal: string | null;
  created_at: string;
  updated_at: string;
}

export interface TemplateExerciseRow {
  id: string;
  template_id: string;
  exercise_id: string;
  name: string;
  muscle_group: MuscleGroup;
  sort_order: number;
  target_sets: number;
  target_reps: number | null;
  target_weight_kg: number | null;
  target_seconds: number | null;
  measure: ExerciseMeasure;
}

export interface TemplateRow {
  id: string;
  plan_id: string;
  name: string;
  activity_type: ActivityType;
  sort_order: number;
  exercises: TemplateExerciseRow[];
}

export interface PlanDetail extends PlanRow {
  templates: TemplateRow[];
}

export async function loadPlans(ctx: AppContext): Promise<PlanDetail[]> {
  const supabase = await createClient();
  const { data: planRows } = await supabase.from("workout_plans").select("*").eq("user_id", ctx.userId).order("updated_at", { ascending: false });
  const plans = (planRows ?? []) as PlanRow[];
  if (plans.length === 0) return [];
  const { data: tRows } = await supabase.from("workout_templates").select("*").in("plan_id", plans.map((p) => p.id)).order("sort_order", { ascending: true });
  const templates = (tRows ?? []) as Omit<TemplateRow, "exercises">[];
  const { data: teRows } = templates.length
    ? await supabase.from("template_exercises").select("*").in("template_id", templates.map((t) => t.id)).order("sort_order", { ascending: true })
    : { data: [] };
  const tes = (teRows ?? []) as Omit<TemplateExerciseRow, "name" | "muscle_group" | "measure">[];
  const exIds = [...new Set(tes.map((t) => t.exercise_id))];
  const { data: exRows } = exIds.length ? await supabase.from("exercises").select("id, name, muscle_group, measure").in("id", exIds) : { data: [] };
  const exMap = new Map(((exRows ?? []) as Pick<ExerciseRow, "id" | "name" | "muscle_group" | "measure">[]).map((e) => [e.id, e]));
  return plans.map((p) => ({
    ...p,
    templates: templates
      .filter((t) => t.plan_id === p.id)
      .map((t) => ({
        ...t,
        exercises: tes
          .filter((te) => te.template_id === t.id)
          .map((te) => ({
            ...te,
            target_weight_kg: te.target_weight_kg === null ? null : Number(te.target_weight_kg),
            name: exMap.get(te.exercise_id)?.name ?? "Oefening",
            muscle_group: exMap.get(te.exercise_id)?.muscle_group ?? "other",
            measure: exMap.get(te.exercise_id)?.measure ?? "reps",
            target_seconds: te.target_seconds ?? null,
          })),
      })),
  }));
}

export async function loadPlan(ctx: AppContext, id: string): Promise<PlanDetail | null> {
  const plans = await loadPlans(ctx);
  return plans.find((p) => p.id === id) ?? null;
}

export async function loadTemplate(ctx: AppContext, id: string): Promise<{ plan: PlanDetail; template: TemplateRow } | null> {
  const plans = await loadPlans(ctx);
  for (const plan of plans) {
    const template = plan.templates.find((t) => t.id === id);
    if (template) return { plan, template };
  }
  return null;
}
