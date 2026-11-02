import "server-only";

import { generateImage } from "ai";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppContext } from "@/lib/data";
import { isDemo } from "@/lib/demo";
import { isOwnedMediaPath } from "@/lib/media-paths";
import { recipeImagePrompt } from "@/lib/recipe-image-prompt";
import type { ActionResult } from "@/lib/types";

/**
 * Models tried in order via Vercel AI Gateway: Flux 3 for realistic food
 * photos, then cheaper fallbacks (for example when a model is not part of the
 * team's credit). RECIPE_IMAGE_MODEL puts another model first.
 */
export const RECIPE_IMAGE_MODELS = [...new Set([process.env.RECIPE_IMAGE_MODEL, "bfl/flux-3-image", "bfl/flux-3-image-klein", "bytedance/seedream-4.0"].filter((m): m is string => Boolean(m)))];

/** Short, readable reason from the gateway, without request details. */
export function gatewayReason(err: unknown): string {
  const e = err as { statusCode?: number; message?: string; responseBody?: string; cause?: unknown };
  let text = e?.message ?? "";
  if (e?.responseBody) {
    try {
      const body = JSON.parse(e.responseBody) as { error?: { message?: string } | string; message?: string };
      text = (typeof body.error === "string" ? body.error : body.error?.message) ?? body.message ?? text;
    } catch {}
  }
  text = text.replace(/\s+/g, " ").trim().slice(0, 180);
  return e?.statusCode ? `${e.statusCode}: ${text}` : text || "onbekende fout";
}

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

  let bytes: Uint8Array | null = null;
  let mediaType = "image/png";
  let reason = "";
  for (const model of RECIPE_IMAGE_MODELS) {
    try {
      const { image } = await generateImage({
        model,
        prompt: recipeImagePrompt(r),
        aspectRatio: "4:3",
        abortSignal: AbortSignal.timeout(90_000),
      });
      bytes = image.uint8Array;
      mediaType = image.mediaType || "image/png";
      break;
    } catch (err) {
      reason = gatewayReason(err);
      console.error(`[recipe-image] ${model} failed: ${reason}`);
    }
  }
  if (!bytes) return { ok: false, error: `AI-foto lukte niet (${reason}).` };

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
