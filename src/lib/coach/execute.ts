import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppContext } from "@/lib/data";
import type { StoredRef } from "./prompt";
import { MAX_MEMORIES, createPlanInput, exerciseKey, forgetMemoryInput, recipeRow, saveMemoryInput, saveRecipeInput } from "./tools";

export interface ToolOutcome {
  /** Text returned to the model as the tool result. */
  content: string;
  isError?: boolean;
  ref?: StoredRef;
}

async function saveRecipe(supabase: SupabaseClient, ctx: AppContext, raw: unknown): Promise<ToolOutcome> {
  const parsed = saveRecipeInput.safeParse(raw);
  if (!parsed.success) return { content: JSON.stringify({ INVALID_INPUT: parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`) }), isError: true };
  const { data, error } = await supabase
    .from("recipes")
    .insert({ ...recipeRow(parsed.data), challenge_id: ctx.challenge.id, user_id: ctx.userId, image_path: null, by_coach: true })
    .select("id, title")
    .single();
  if (error || !data) return { content: "Opslaan in de Kitchen is mislukt.", isError: true };
  const row = data as { id: string; title: string };
  return { content: JSON.stringify({ saved: true, recipe_id: row.id, title: row.title }), ref: { type: "recipe", id: row.id, name: row.title } };
}

async function createPlan(supabase: SupabaseClient, ctx: AppContext, raw: unknown): Promise<ToolOutcome> {
  const parsed = createPlanInput.safeParse(raw);
  if (!parsed.success) return { content: JSON.stringify({ INVALID_INPUT: parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`) }), isError: true };
  const input = parsed.data;

  const { data: exRows } = await supabase
    .from("exercises")
    .select("id, name")
    .or(`owner_user_id.is.null,owner_user_id.eq.${ctx.userId}`);
  const byKey = new Map(((exRows ?? []) as { id: string; name: string }[]).map((e) => [exerciseKey(e.name), e.id]));

  const { data: plan, error: planError } = await supabase
    .from("workout_plans")
    .insert({ user_id: ctx.userId, name: input.name, goal: input.goal || null, description: input.description || null, by_coach: true })
    .select("id, name")
    .single();
  if (planError || !plan) return { content: "Het schema aanmaken is mislukt.", isError: true };
  const planRow = plan as { id: string; name: string };

  const added: string[] = [];
  for (const [ti, w] of input.workouts.entries()) {
    const { data: template, error: tError } = await supabase
      .from("workout_templates")
      .insert({ plan_id: planRow.id, name: w.name, activity_type: w.activity_type, sort_order: ti })
      .select("id")
      .single();
    if (tError || !template) continue;
    const templateId = (template as { id: string }).id;
    for (const [ei, e] of w.exercises.entries()) {
      let exerciseId = byKey.get(exerciseKey(e.name));
      if (!exerciseId) {
        const { data: created } = await supabase
          .from("exercises")
          .insert({ name: e.name, muscle_group: e.muscle_group ?? "other", is_custom: true, owner_user_id: ctx.userId })
          .select("id")
          .single();
        exerciseId = (created as { id: string } | null)?.id;
        if (exerciseId) {
          byKey.set(exerciseKey(e.name), exerciseId);
          added.push(e.name);
        }
      }
      if (!exerciseId) continue;
      await supabase.from("template_exercises").insert({
        template_id: templateId,
        exercise_id: exerciseId,
        sort_order: ei,
        target_sets: e.sets,
        target_reps: e.reps ?? null,
        target_weight_kg: e.weight_kg ?? null,
      });
    }
  }
  return {
    content: JSON.stringify({ saved: true, plan_id: planRow.id, name: planRow.name, workouts: input.workouts.length, new_custom_exercises: added }),
    ref: { type: "plan", id: planRow.id, name: planRow.name },
  };
}

async function saveMemory(supabase: SupabaseClient, ctx: AppContext, raw: unknown): Promise<ToolOutcome> {
  const parsed = saveMemoryInput.safeParse(raw);
  if (!parsed.success) return { content: "Een notitie moet tussen 1 en 200 tekens zijn.", isError: true };
  const { count } = await supabase.from("coach_memories").select("id", { count: "exact", head: true }).eq("user_id", ctx.userId);
  if ((count ?? 0) >= MAX_MEMORIES) return { content: `Je geheugen is vol (${MAX_MEMORIES} notities). Vergeet eerst een notitie die niet meer belangrijk is.`, isError: true };
  const { data, error } = await supabase
    .from("coach_memories")
    .insert({ challenge_id: ctx.challenge.id, user_id: ctx.userId, content: parsed.data.content, source: "coach" })
    .select("id, content")
    .single();
  if (error || !data) return { content: "Onthouden is mislukt.", isError: true };
  const row = data as { id: string; content: string };
  return { content: JSON.stringify({ saved: true, id: row.id }), ref: { type: "memory", id: row.id, name: row.content } };
}

async function forgetMemory(supabase: SupabaseClient, ctx: AppContext, raw: unknown): Promise<ToolOutcome> {
  const parsed = forgetMemoryInput.safeParse(raw);
  if (!parsed.success) return { content: "Onbekende notitie.", isError: true };
  const { error } = await supabase.from("coach_memories").delete().eq("id", parsed.data.id).eq("user_id", ctx.userId);
  if (error) return { content: "Vergeten is mislukt.", isError: true };
  return { content: JSON.stringify({ forgotten: true }) };
}

export async function executeCoachTool(name: string, input: unknown, supabase: SupabaseClient, ctx: AppContext): Promise<ToolOutcome> {
  try {
    if (name === "save_recipe") return await saveRecipe(supabase, ctx, input);
    if (name === "create_workout_plan") return await createPlan(supabase, ctx, input);
    if (name === "save_memory") return await saveMemory(supabase, ctx, input);
    if (name === "forget_memory") return await forgetMemory(supabase, ctx, input);
    return { content: `Onbekende tool: ${name}`, isError: true };
  } catch {
    return { content: "Er ging iets mis bij het uitvoeren.", isError: true };
  }
}
