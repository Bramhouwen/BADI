"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/data";
import { friendlyError } from "@/lib/errors";
import { isValidDateKey, todayKey } from "@/lib/dates";
import { ACTIVITY_TYPE_KEYS, activityMeta, type ActivityType } from "@/lib/fitness";
import { clearWorkoutSources, setWorkoutSources } from "@/lib/checkin-sync";
import { loadPlan, loadSessionDetail } from "@/lib/fitness/data";
import type { ActionResult } from "@/lib/types";

const uuid = z.string().uuid();
const activityType = z.enum(ACTIVITY_TYPE_KEYS as [ActivityType, ...ActivityType[]]);

function revalidateFitness() {
  revalidatePath("/fitness", "layout");
  revalidatePath("/");
  revalidatePath("/checkin");
}

/* ------------------------------------------------------------------------ */
/* Cardio and duration-based sessions                                        */
/* ------------------------------------------------------------------------ */

const cardioSchema = z.object({
  activity_type: activityType,
  title: z.string().trim().min(1, "Geef je training een naam.").max(80, "Maximaal 80 tekens."),
  workout_date: z.string().refine(isValidDateKey, "Kies een geldige datum."),
  start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).or(z.literal("")).default(""),
  hours: z.coerce.number().int().min(0).max(23).default(0),
  minutes: z.coerce.number().int().min(0).max(59).default(0),
  seconds: z.coerce.number().int().min(0).max(59).default(0),
  distance_km: z.coerce.number().min(0).max(1000).optional().default(0),
  notes: z.string().trim().max(1000, "Maximaal 1000 tekens.").optional().default(""),
});

type CardioRow = { activity_type: ActivityType; title: string; workout_date: string; started_at: string | null; duration_seconds: number; distance_meters: number | null; notes: string | null };

function cardioToRow(data: z.output<typeof cardioSchema>, timezoneToday: string): { error: string; row?: undefined } | { row: CardioRow; error?: undefined } {
  const duration = data.hours * 3600 + data.minutes * 60 + data.seconds;
  if (duration <= 0) return { error: "Vul een trainingsduur in." };
  if (data.workout_date > timezoneToday) return { error: "Een training kan niet in de toekomst liggen." };
  const meta = activityMeta(data.activity_type);
  const distance = meta.kind === "cardio" ? Math.round(data.distance_km * 1000) : null;
  if (meta.kind === "cardio" && (!distance || distance <= 0)) return { error: "Vul de afstand in kilometers in." };
  const startedAt = data.start_time ? `${data.workout_date}T${data.start_time}:00+01:00` : null;
  return {
    row: {
      activity_type: data.activity_type,
      title: data.title,
      workout_date: data.workout_date,
      started_at: startedAt,
      duration_seconds: duration,
      distance_meters: distance,
      notes: data.notes || null,
    },
  };
}

export async function createCardioSession(formData: FormData): Promise<ActionResult> {
  const parsed = cardioSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const ctx = await requireContext();
  const today = todayKey(new Date(), ctx.challenge.timezone);
  const conv = cardioToRow(parsed.data, today);
  if (!conv.row) return { ok: false, error: conv.error };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workout_sessions")
    .insert({ ...conv.row, user_id: ctx.userId, challenge_id: ctx.challenge.id, status: "completed", completed_at: new Date().toISOString() })
    .select("id")
    .single();
  if (error) return { ok: false, error: friendlyError(error) };
  await setWorkoutSources(ctx, data.id as string, conv.row.workout_date as string, activityMeta(conv.row.activity_type).checkin);
  revalidateFitness();
  redirect(`/fitness/history/${data.id}?done=1`);
}

export async function updateCardioSession(id: string, formData: FormData): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Onbekende training." };
  const parsed = cardioSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const ctx = await requireContext();
  const today = todayKey(new Date(), ctx.challenge.timezone);
  const conv = cardioToRow(parsed.data, today);
  if (!conv.row) return { ok: false, error: conv.error };
  const supabase = await createClient();
  const { error } = await supabase.from("workout_sessions").update(conv.row).eq("id", id).eq("user_id", ctx.userId);
  if (error) return { ok: false, error: friendlyError(error) };
  await setWorkoutSources(ctx, id, conv.row.workout_date as string, activityMeta(conv.row.activity_type).checkin);
  revalidateFitness();
  redirect(`/fitness/history/${id}`);
}

/* ------------------------------------------------------------------------ */
/* Strength sessions                                                         */
/* ------------------------------------------------------------------------ */

export interface DraftSet {
  weight_kg: number | null;
  repetitions: number | null;
  /** Timed exercises (plank): how long the set was held. */
  duration_seconds: number | null;
  completed: boolean;
}
export interface DraftExercise {
  exercise_id: string;
  notes: string;
  sets: DraftSet[];
}
export interface StrengthDraft {
  title: string;
  workout_date: string;
  notes: string;
  exercises: DraftExercise[];
  /** Only sent when the duration is typed in (logging afterwards or editing); a live timer passes it on finish. */
  duration_seconds?: number | null;
}

const draftSchema = z.object({
  title: z.string().trim().min(1, "Geef je training een naam.").max(80),
  workout_date: z.string().refine(isValidDateKey, "Kies een geldige datum."),
  notes: z.string().trim().max(1000).default(""),
  exercises: z
    .array(
      z.object({
        exercise_id: uuid,
        notes: z.string().trim().max(300).default(""),
        sets: z
          .array(
            z.object({
              weight_kg: z.number().min(0).max(1000).nullable(),
              repetitions: z.number().int().min(0).max(1000).nullable(),
              duration_seconds: z.number().int().min(0).max(3600).nullable().default(null),
              completed: z.boolean(),
            }),
          )
          .max(50),
      }),
    )
    .max(40),
  duration_seconds: z.number().int().min(0).max(86400).nullable().optional(),
});

/**
 * Creates a draft strength session, optionally pre-filled from a template or an earlier session.
 * `afterwards` logs a finished workout: no live timer (started_at stays empty) and the duration is typed in.
 */
export async function startStrengthSession(opts: { templateId?: string; repeatOf?: string; afterwards?: boolean } = {}): Promise<ActionResult> {
  const ctx = await requireContext();
  const supabase = await createClient();
  const today = todayKey(new Date(), ctx.challenge.timezone);

  let title = "Krachttraining";
  let templateId: string | null = null;
  const exercises: { exercise_id: string; notes: string | null; sets: DraftSet[] }[] = [];

  if (opts.templateId && uuid.safeParse(opts.templateId).success) {
    const { data: t } = await supabase.from("workout_templates").select("id, plan_id, name").eq("id", opts.templateId).maybeSingle();
    if (t) {
      const plan = await loadPlan(ctx, t.plan_id as string);
      const template = plan?.templates.find((x) => x.id === t.id);
      if (template) {
        title = template.name;
        templateId = template.id;
        for (const te of template.exercises) {
          exercises.push({
            exercise_id: te.exercise_id,
            notes: null,
            sets: Array.from({ length: te.target_sets }, () => ({ weight_kg: te.target_weight_kg, repetitions: te.measure === "time" ? null : te.target_reps, duration_seconds: te.measure === "time" ? te.target_seconds : null, completed: false })),
          });
        }
      }
    }
  } else if (opts.repeatOf && uuid.safeParse(opts.repeatOf).success) {
    const prev = await loadSessionDetail(ctx, opts.repeatOf);
    if (prev) {
      title = prev.title;
      templateId = prev.template_id;
      for (const e of prev.exercises) {
        exercises.push({ exercise_id: e.exercise_id, notes: e.notes, sets: e.sets.map((s) => ({ weight_kg: s.weight_kg, repetitions: s.repetitions, duration_seconds: s.duration_seconds, completed: false })) });
      }
    }
  }

  const { data: session, error } = await supabase
    .from("workout_sessions")
    .insert({ user_id: ctx.userId, challenge_id: ctx.challenge.id, template_id: templateId, activity_type: "strength", title, workout_date: today, started_at: opts.afterwards ? null : new Date().toISOString(), status: "draft" })
    .select("id")
    .single();
  if (error) return { ok: false, error: friendlyError(error) };
  await writeExercises(session.id as string, exercises);
  revalidateFitness();
  redirect(`/fitness/workout/${session.id}`);
}

async function writeExercises(sessionId: string, exercises: { exercise_id: string; notes: string | null; sets: DraftSet[] }[]) {
  const supabase = await createClient();
  await supabase.from("workout_exercises").delete().eq("session_id", sessionId);
  for (let i = 0; i < exercises.length; i++) {
    const ex = exercises[i];
    const { data: we, error } = await supabase
      .from("workout_exercises")
      .insert({ session_id: sessionId, exercise_id: ex.exercise_id, sort_order: i, notes: ex.notes || null })
      .select("id")
      .single();
    if (error || !we) continue;
    if (ex.sets.length) {
      await supabase.from("exercise_sets").insert(
        ex.sets.map((s, n) => ({ workout_exercise_id: we.id, set_number: n + 1, weight_kg: s.weight_kg, repetitions: s.repetitions, duration_seconds: s.duration_seconds ?? null, completed: s.completed })),
      );
    }
  }
}

export async function saveStrengthDraft(id: string, draft: StrengthDraft): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Onbekende training." };
  const parsed = draftSchema.safeParse(draft);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const ctx = await requireContext();
  const supabase = await createClient();
  const { data: own } = await supabase.from("workout_sessions").select("id").eq("id", id).eq("user_id", ctx.userId).maybeSingle();
  if (!own) return { ok: false, error: "Deze training is niet van jou." };
  const { error } = await supabase
    .from("workout_sessions")
    .update({
      title: parsed.data.title,
      workout_date: parsed.data.workout_date,
      notes: parsed.data.notes || null,
      ...(parsed.data.duration_seconds !== undefined ? { duration_seconds: parsed.data.duration_seconds || null } : {}),
    })
    .eq("id", id)
    .eq("user_id", ctx.userId);
  if (error) return { ok: false, error: friendlyError(error) };
  await writeExercises(id, parsed.data.exercises.map((e) => ({ exercise_id: e.exercise_id, notes: e.notes, sets: e.sets })));
  return { ok: true };
}

export async function finishStrengthSession(id: string, draft: StrengthDraft, durationSeconds: number): Promise<ActionResult> {
  const saved = await saveStrengthDraft(id, draft);
  if (!saved.ok) return saved;
  const ctx = await requireContext();
  const today = todayKey(new Date(), ctx.challenge.timezone);
  if (draft.workout_date > today) return { ok: false, error: "Een training kan niet in de toekomst liggen." };
  const duration = Number.isFinite(durationSeconds) ? Math.max(0, Math.min(86400, Math.round(durationSeconds))) : 0;
  const supabase = await createClient();
  const { error } = await supabase
    .from("workout_sessions")
    .update({ status: "completed", completed_at: new Date().toISOString(), duration_seconds: duration > 0 ? duration : null })
    .eq("id", id)
    .eq("user_id", ctx.userId);
  if (error) return { ok: false, error: friendlyError(error) };
  await setWorkoutSources(ctx, id, draft.workout_date, activityMeta("strength").checkin);
  revalidateFitness();
  redirect(`/fitness/history/${id}?done=1`);
}

export async function deleteSession(id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Onbekende training." };
  const ctx = await requireContext();
  await clearWorkoutSources(ctx, id);
  const supabase = await createClient();
  const { error } = await supabase.from("workout_sessions").delete().eq("id", id).eq("user_id", ctx.userId);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidateFitness();
  redirect("/fitness/history");
}

/** Throws away an unfinished (draft) workout. Completed workouts go through deleteSession. */
export async function discardDraft(id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Onbekende training." };
  const ctx = await requireContext();
  const supabase = await createClient();
  const { data, error } = await supabase.from("workout_sessions").delete().eq("id", id).eq("user_id", ctx.userId).eq("status", "draft").select("id");
  if (error) return { ok: false, error: friendlyError(error) };
  if (!data || data.length === 0) return { ok: false, error: "Dit concept bestaat niet meer." };
  revalidateFitness();
  return { ok: true };
}

/** Repeats a completed session: strength opens a new draft, cardio opens a pre-filled form. */
export async function repeatSession(id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Onbekende training." };
  const ctx = await requireContext();
  const prev = await loadSessionDetail(ctx, id);
  if (!prev) return { ok: false, error: "Training niet gevonden." };
  if (prev.activity_type === "strength") return startStrengthSession({ repeatOf: id });
  redirect(`/fitness/start/${prev.activity_type}?from=${id}`);
}

/* ------------------------------------------------------------------------ */
/* Exercise library                                                          */
/* ------------------------------------------------------------------------ */

const exerciseSchema = z.object({
  name: z.string().trim().min(1, "Geef de oefening een naam.").max(60, "Maximaal 60 tekens."),
  muscle_group: z.enum(["legs", "chest", "back", "shoulders", "arms", "core", "mobility", "cardio", "other"]),
  measure: z.enum(["reps", "time"]).default("reps"),
});

export async function createExercise(input: { name: string; muscle_group: string; measure?: string }): Promise<ActionResult<{ id: string }>> {
  const parsed = exerciseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const ctx = await requireContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercises")
    .insert({ ...parsed.data, is_custom: true, owner_user_id: ctx.userId })
    .select("id")
    .single();
  if (error) return { ok: false, error: friendlyError(error) };
  revalidateFitness();
  return { ok: true, data: { id: data.id as string } };
}

export async function updateExercise(id: string, input: { name: string; muscle_group: string; measure?: string }): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Onbekende oefening." };
  const parsed = exerciseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const ctx = await requireContext();
  const supabase = await createClient();
  const { error } = await supabase.from("exercises").update(parsed.data).eq("id", id).eq("owner_user_id", ctx.userId);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidateFitness();
  return { ok: true };
}

export async function deleteExercise(id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Onbekende oefening." };
  const ctx = await requireContext();
  const supabase = await createClient();
  const { error } = await supabase.from("exercises").delete().eq("id", id).eq("owner_user_id", ctx.userId);
  if (error) {
    if (error.message.includes("foreign key") || error.message.includes("violates")) {
      return { ok: false, error: "Deze oefening zit in een training of schema en kan daarom niet worden verwijderd." };
    }
    return { ok: false, error: friendlyError(error) };
  }
  revalidateFitness();
  return { ok: true };
}

/* ------------------------------------------------------------------------ */
/* Plans and templates                                                       */
/* ------------------------------------------------------------------------ */

const planSchema = z.object({
  name: z.string().trim().min(1, "Geef je schema een naam.").max(60, "Maximaal 60 tekens."),
  description: z.string().trim().max(500).optional().default(""),
  goal: z.string().trim().max(120).optional().default(""),
});

export async function createPlan(formData: FormData): Promise<ActionResult> {
  const parsed = planSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const ctx = await requireContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workout_plans")
    .insert({ user_id: ctx.userId, name: parsed.data.name, description: parsed.data.description || null, goal: parsed.data.goal || null })
    .select("id")
    .single();
  if (error) return { ok: false, error: friendlyError(error) };
  revalidateFitness();
  redirect(`/fitness/plans/${data.id}`);
}

export async function updatePlan(id: string, formData: FormData): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Onbekend schema." };
  const parsed = planSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const ctx = await requireContext();
  const supabase = await createClient();
  const { error } = await supabase
    .from("workout_plans")
    .update({ name: parsed.data.name, description: parsed.data.description || null, goal: parsed.data.goal || null })
    .eq("id", id)
    .eq("user_id", ctx.userId);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidateFitness();
  return { ok: true };
}

export async function deletePlan(id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Onbekend schema." };
  const ctx = await requireContext();
  const supabase = await createClient();
  const { error } = await supabase.from("workout_plans").delete().eq("id", id).eq("user_id", ctx.userId);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidateFitness();
  redirect("/fitness/plans");
}

export async function duplicatePlan(id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Onbekend schema." };
  const ctx = await requireContext();
  const plan = await loadPlan(ctx, id);
  if (!plan) return { ok: false, error: "Schema niet gevonden." };
  const supabase = await createClient();
  const { data: copy, error } = await supabase
    .from("workout_plans")
    .insert({ user_id: ctx.userId, name: `${plan.name} (kopie)`.slice(0, 60), description: plan.description, goal: plan.goal })
    .select("id")
    .single();
  if (error) return { ok: false, error: friendlyError(error) };
  for (const t of plan.templates) {
    const { data: nt } = await supabase.from("workout_templates").insert({ plan_id: copy.id, name: t.name, activity_type: t.activity_type, sort_order: t.sort_order }).select("id").single();
    if (!nt) continue;
    if (t.exercises.length) {
      await supabase.from("template_exercises").insert(
        t.exercises.map((e) => ({ template_id: nt.id, exercise_id: e.exercise_id, sort_order: e.sort_order, target_sets: e.target_sets, target_reps: e.target_reps, target_weight_kg: e.target_weight_kg, target_seconds: e.target_seconds })),
      );
    }
  }
  revalidateFitness();
  redirect(`/fitness/plans/${copy.id}`);
}

const templateSchema = z.object({
  name: z.string().trim().min(1, "Geef de workout een naam.").max(60),
  activity_type: activityType.default("strength"),
});

export async function addTemplate(planId: string, input: { name: string; activity_type: string }): Promise<ActionResult> {
  if (!uuid.safeParse(planId).success) return { ok: false, error: "Onbekend schema." };
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const ctx = await requireContext();
  const plan = await loadPlan(ctx, planId);
  if (!plan) return { ok: false, error: "Schema niet gevonden." };
  const supabase = await createClient();
  const { error } = await supabase.from("workout_templates").insert({ plan_id: planId, name: parsed.data.name, activity_type: parsed.data.activity_type, sort_order: plan.templates.length });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidateFitness();
  return { ok: true };
}

export async function updateTemplate(id: string, input: { name: string }): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Onbekende workout." };
  const name = z.string().trim().min(1).max(60).safeParse(input.name);
  if (!name.success) return { ok: false, error: "Geef de workout een naam." };
  await requireContext();
  const supabase = await createClient();
  const { error } = await supabase.from("workout_templates").update({ name: name.data }).eq("id", id);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidateFitness();
  return { ok: true };
}

export async function deleteTemplate(id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Onbekende workout." };
  await requireContext();
  const supabase = await createClient();
  const { error } = await supabase.from("workout_templates").delete().eq("id", id);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidateFitness();
  return { ok: true };
}

export async function moveTemplate(planId: string, id: string, direction: "up" | "down"): Promise<ActionResult> {
  const ctx = await requireContext();
  const plan = await loadPlan(ctx, planId);
  if (!plan) return { ok: false, error: "Schema niet gevonden." };
  const order = plan.templates.map((t) => t.id);
  const i = order.indexOf(id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= order.length) return { ok: true };
  [order[i], order[j]] = [order[j], order[i]];
  const supabase = await createClient();
  for (let k = 0; k < order.length; k++) await supabase.from("workout_templates").update({ sort_order: k }).eq("id", order[k]);
  revalidateFitness();
  return { ok: true };
}

const templateExerciseSchema = z.object({
  exercise_id: uuid,
  target_sets: z.number().int().min(1).max(20),
  target_reps: z.number().int().min(1).max(500).nullable(),
  target_weight_kg: z.number().min(0).max(1000).nullable(),
  target_seconds: z.number().int().min(1).max(3600).nullable().default(null),
});

export async function addTemplateExercise(templateId: string, input: z.input<typeof templateExerciseSchema>): Promise<ActionResult> {
  if (!uuid.safeParse(templateId).success) return { ok: false, error: "Onbekende workout." };
  const parsed = templateExerciseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Controleer sets, herhalingen, tijd en gewicht." };
  await requireContext();
  const supabase = await createClient();
  const { count } = await supabase.from("template_exercises").select("id", { count: "exact", head: true }).eq("template_id", templateId);
  const { error } = await supabase.from("template_exercises").insert({ template_id: templateId, ...parsed.data, sort_order: count ?? 0 });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidateFitness();
  return { ok: true };
}

export async function updateTemplateExercise(id: string, input: { target_sets: number; target_reps: number | null; target_weight_kg: number | null; target_seconds?: number | null }): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Onbekende oefening." };
  const parsed = templateExerciseSchema.omit({ exercise_id: true }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Controleer sets, herhalingen, tijd en gewicht." };
  await requireContext();
  const supabase = await createClient();
  const { error } = await supabase.from("template_exercises").update(parsed.data).eq("id", id);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidateFitness();
  return { ok: true };
}

export async function removeTemplateExercise(id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Onbekende oefening." };
  await requireContext();
  const supabase = await createClient();
  const { error } = await supabase.from("template_exercises").delete().eq("id", id);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidateFitness();
  return { ok: true };
}

export async function moveTemplateExercise(templateId: string, id: string, direction: "up" | "down"): Promise<ActionResult> {
  await requireContext();
  const supabase = await createClient();
  const { data } = await supabase.from("template_exercises").select("id").eq("template_id", templateId).order("sort_order", { ascending: true });
  const order = ((data ?? []) as { id: string }[]).map((r) => r.id);
  const i = order.indexOf(id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= order.length) return { ok: true };
  [order[i], order[j]] = [order[j], order[i]];
  for (let k = 0; k < order.length; k++) await supabase.from("template_exercises").update({ sort_order: k }).eq("id", order[k]);
  revalidateFitness();
  return { ok: true };
}

/** Starts a workout from a template: strength opens the logger, cardio opens the pre-filled form. */
export async function startFromTemplate(templateId: string, afterwards = false): Promise<ActionResult> {
  if (!uuid.safeParse(templateId).success) return { ok: false, error: "Onbekende workout." };
  const ctx = await requireContext();
  const supabase = await createClient();
  const { data: t } = await supabase.from("workout_templates").select("id, name, activity_type").eq("id", templateId).maybeSingle();
  if (!t) return { ok: false, error: "Workout niet gevonden." };
  void ctx;
  if (t.activity_type === "strength") return startStrengthSession({ templateId, afterwards });
  redirect(`/fitness/start/${t.activity_type}?title=${encodeURIComponent(t.name as string)}${afterwards ? "&achteraf=1" : ""}`);
}
