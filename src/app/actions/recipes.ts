"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/data";
import { friendlyError } from "@/lib/errors";
import { isOwnedMediaPath, isStaticMediaPath } from "@/lib/storage";
import { REACTION_KEYS, RECIPE_CATEGORIES, type ReactionKey } from "@/lib/constants";
import type { ActionResult } from "@/lib/types";

const recipeSchema = z.object({
  title: z.string().trim().min(1, "Geef je recept een naam.").max(80, "Maximaal 80 tekens."),
  description: z.string().trim().max(500, "Maximaal 500 tekens.").optional().default(""),
  ingredients: z.string().trim().max(2000, "Maximaal 2000 tekens.").optional().default(""),
  instructions: z.string().trim().max(4000, "Maximaal 4000 tekens.").optional().default(""),
  category: z
    .string()
    .trim()
    .max(30)
    .optional()
    .default("")
    .refine((c) => c === "" || (RECIPE_CATEGORIES as readonly string[]).includes(c), "Onbekende categorie."),
  protein_grams: z
    .string()
    .trim()
    .optional()
    .default("")
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 0 && v <= 300), "Eiwit in hele grammen, maximaal 300."),
  image_path: z.string().min(1, "Een foto is verplicht."),
});

function toRow(data: z.infer<typeof recipeSchema>) {
  return {
    title: data.title,
    description: data.description || null,
    ingredients: data.ingredients || null,
    instructions: data.instructions || null,
    category: data.category || null,
    protein_grams: data.protein_grams,
    image_path: data.image_path,
  };
}

export async function createRecipe(formData: FormData): Promise<ActionResult> {
  const parsed = recipeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const ctx = await requireContext();
  if (!isOwnedMediaPath(parsed.data.image_path, ctx.challenge.id, ctx.userId)) return { ok: false, error: "Ongeldige foto." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipes")
    .insert({ ...toRow(parsed.data), challenge_id: ctx.challenge.id, user_id: ctx.userId })
    .select("id")
    .single();
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/kitchen");
  revalidatePath("/");
  redirect(`/kitchen/${data.id}?created=1`);
}

export async function updateRecipe(id: string, formData: FormData): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Onbekend recept." };
  const parsed = recipeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const ctx = await requireContext();
  if (!isOwnedMediaPath(parsed.data.image_path, ctx.challenge.id, ctx.userId)) return { ok: false, error: "Ongeldige foto." };
  const supabase = await createClient();
  const { error } = await supabase.from("recipes").update(toRow(parsed.data)).eq("id", id).eq("user_id", ctx.userId);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/kitchen");
  revalidatePath(`/kitchen/${id}`);
  redirect(`/kitchen/${id}`);
}

export async function deleteRecipe(id: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Onbekend recept." };
  const ctx = await requireContext();
  const supabase = await createClient();
  const { data: recipe } = await supabase.from("recipes").select("image_path").eq("id", id).eq("user_id", ctx.userId).maybeSingle();
  if (!recipe) return { ok: false, error: "Je kunt alleen je eigen recepten verwijderen." };
  const { error } = await supabase.from("recipes").delete().eq("id", id).eq("user_id", ctx.userId);
  if (error) return { ok: false, error: friendlyError(error) };
  if (!isStaticMediaPath(recipe.image_path as string)) await supabase.storage.from("recipes").remove([recipe.image_path as string]);
  revalidatePath("/kitchen");
  revalidatePath("/");
  redirect("/kitchen");
}

export async function toggleFavorite(recipeId: string, favorite: boolean): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(recipeId).success) return { ok: false, error: "Onbekend recept." };
  const ctx = await requireContext();
  const supabase = await createClient();
  const { error } = favorite
    ? await supabase.from("recipe_favorites").upsert({ recipe_id: recipeId, user_id: ctx.userId }, { onConflict: "recipe_id,user_id" })
    : await supabase.from("recipe_favorites").delete().eq("recipe_id", recipeId).eq("user_id", ctx.userId);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/kitchen");
  revalidatePath(`/kitchen/${recipeId}`);
  return { ok: true };
}

export async function setRecipeReaction(recipeId: string, reaction: ReactionKey | null): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(recipeId).success) return { ok: false, error: "Onbekend recept." };
  if (reaction !== null && !REACTION_KEYS.includes(reaction)) return { ok: false, error: "Onbekende reactie." };
  const ctx = await requireContext();
  const supabase = await createClient();
  const { error } = reaction
    ? await supabase.from("recipe_reactions").upsert({ recipe_id: recipeId, user_id: ctx.userId, reaction }, { onConflict: "recipe_id,user_id" })
    : await supabase.from("recipe_reactions").delete().eq("recipe_id", recipeId).eq("user_id", ctx.userId);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath(`/kitchen/${recipeId}`);
  return { ok: true };
}
