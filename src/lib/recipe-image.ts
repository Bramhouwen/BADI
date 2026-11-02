import "server-only";

import { generateImage } from "ai";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppContext } from "@/lib/data";
import { isDemo } from "@/lib/demo";
import { isOwnedMediaPath } from "@/lib/media-paths";
import { recipeImagePrompt } from "@/lib/recipe-image-prompt";
import type { ActionResult } from "@/lib/types";

/** Flux 3 via Vercel AI Gateway: realistic food photos. Override with RECIPE_IMAGE_MODEL. */
export const RECIPE_IMAGE_MODEL = process.env.RECIPE_IMAGE_MODEL || "bfl/flux-3-image";

/** On Vercel the gateway signs in with the deployment's OIDC token; locally an AI_GATEWAY_API_KEY is needed. */
export function aiImagesAvailable(): boolean {
  if (isDemo()) return false;
  return Boolean(process.env.VERCEL || process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
}

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

const ERRORS: Record<string, string> = {
  HAS_PHOTO: "Dit recept heeft al een eigen foto.",
  AI_LIMIT: "Het maximum aantal AI-foto's voor vandaag is bereikt. Probeer het morgen weer.",
  NOT_FOUND: "Dit recept bestaat niet meer.",
};

/**
 * Generates a photo for a recipe without one (or with an AI photo), stores it
 * in the caller's folder of the "recipes" bucket and attaches it through a
 * database function that checks membership, ownership of the file and the
 * daily cap.
 */
export async function generateRecipePhotoFor(supabase: SupabaseClient, ctx: AppContext, recipeId: string): Promise<ActionResult> {
  if (!aiImagesAvailable()) return { ok: false, error: "AI-foto's zijn hier niet beschikbaar." };
  const { data: recipe } = await supabase.from("recipes").select("id, title, category, ingredients, image_path, image_ai").eq("id", recipeId).maybeSingle();
  if (!recipe) return { ok: false, error: ERRORS.NOT_FOUND };
  const r = recipe as { id: string; title: string; category: string | null; ingredients: string | null; image_path: string | null; image_ai: boolean };
  if (r.image_path && !r.image_ai) return { ok: false, error: ERRORS.HAS_PHOTO };

  const { data: left } = await supabase.rpc("recipe_ai_quota_left");
  if (typeof left === "number" && left <= 0) return { ok: false, error: ERRORS.AI_LIMIT };

  let bytes: Uint8Array;
  let mediaType: string;
  try {
    const { image } = await generateImage({
      model: RECIPE_IMAGE_MODEL,
      prompt: recipeImagePrompt(r),
      aspectRatio: "4:3",
      abortSignal: AbortSignal.timeout(90_000),
    });
    bytes = image.uint8Array;
    mediaType = image.mediaType || "image/png";
  } catch {
    return { ok: false, error: "De AI-foto maken lukte niet. Probeer het zo nog eens." };
  }

  const path = `${ctx.challenge.id}/${ctx.userId}/ai-${r.id}-${Date.now()}.${EXT[mediaType] ?? "png"}`;
  const { error: uploadError } = await supabase.storage.from("recipes").upload(path, bytes, { contentType: mediaType, upsert: false });
  if (uploadError) return { ok: false, error: "Opslaan van de foto lukte niet." };

  const { error } = await supabase.rpc("set_recipe_ai_image", { p_recipe: r.id, p_path: path });
  if (error) {
    await supabase.storage.from("recipes").remove([path]);
    const code = Object.keys(ERRORS).find((k) => error.message?.includes(k));
    return { ok: false, error: code ? ERRORS[code] : "De foto koppelen lukte niet." };
  }
  // Tidy up an earlier AI photo when it sits in our own folder.
  if (r.image_ai && r.image_path && isOwnedMediaPath(r.image_path, ctx.challenge.id, ctx.userId)) await supabase.storage.from("recipes").remove([r.image_path]);

  revalidatePath("/kitchen");
  revalidatePath(`/kitchen/${r.id}`);
  revalidatePath("/");
  return { ok: true };
}
