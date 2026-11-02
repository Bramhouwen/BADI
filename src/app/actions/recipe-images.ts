"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/data";
import { generateRecipePhotoFor } from "@/lib/recipe-image";
import type { ActionResult } from "@/lib/types";

/** Makes (or remakes) the AI photo of one recipe. Takes a few seconds. */
export async function generateRecipePhoto(recipeId: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(recipeId).success) return { ok: false, error: "Onbekend recept." };
  const ctx = await requireContext();
  const supabase = await createClient();
  return generateRecipePhotoFor(supabase, ctx, recipeId);
}

/** Gives up to six recipes without a photo an AI photo, one after another. */
export async function generateMissingPhotos(): Promise<ActionResult<{ made: number; left: number }>> {
  const ctx = await requireContext();
  const supabase = await createClient();
  const { data } = await supabase.from("recipes").select("id").eq("challenge_id", ctx.challenge.id).is("image_path", null).order("created_at", { ascending: false }).limit(20);
  const ids = ((data ?? []) as { id: string }[]).map((r) => r.id);
  let made = 0;
  let lastError: string | null = null;
  for (const id of ids.slice(0, 6)) {
    const r = await generateRecipePhotoFor(supabase, ctx, id);
    if (r.ok) made += 1;
    else {
      lastError = r.error;
      if (r.error.includes("maximum") || r.error.includes("niet beschikbaar")) break;
    }
  }
  if (made === 0 && lastError) return { ok: false, error: lastError };
  return { ok: true, data: { made, left: Math.max(0, ids.length - made) } };
}
