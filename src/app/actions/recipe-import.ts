"use server";

import { requireContext } from "@/lib/data";
import { IMPORT_TEXT_MAX, firstUrl, isTikTok, pageText, publicUrl, recipeFromHtml, type RecipeDraft } from "@/lib/recipe-import";
import { ImportError, fetchPublic, readRecipe, tiktokCaption } from "@/lib/recipe-import-server";
import type { ActionResult } from "@/lib/types";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_IMAGE_BYTES = 1_500_000;
const NOT_FOUND = "Hier staat geen recept in dat de app kan uitlezen. Probeer een screenshot of plak de tekst.";

async function fromLink(raw: string): Promise<RecipeDraft> {
  const url = publicUrl(raw);
  if (!url) throw new ImportError("Dit is geen geldige link.");

  if (isTikTok(url)) {
    const { url: video, caption, trace } = await tiktokCaption(url.toString());
    if (!caption) throw new ImportError(`TikTok gaf de beschrijving van deze video niet door (${trace}). Maak een screenshot van het recept of plak de tekst.`);
    if (caption.length < 30) throw new ImportError("De beschrijving van deze TikTok is te kort voor een recept. Maak een screenshot van het recept in de video.");
    const draft = await readRecipe({ text: caption }, video);
    if (!draft) throw new ImportError("In de beschrijving van deze TikTok staan geen ingrediënten of stappen. Maak een screenshot van het recept in de video.");
    return draft;
  }

  const page = await fetchPublic(url.toString());
  if (page.status === 401 || page.status === 403 || page.status === 429) {
    throw new ImportError("Deze site laat de app niet binnen (Albert Heijn doet dat bijvoorbeeld). Kopieer de tekst van het recept of maak een screenshot.");
  }
  if (page.status !== 200 || !page.body) throw new ImportError("Deze pagina kon de app niet openen. Kopieer de tekst of maak een screenshot.");
  const structured = recipeFromHtml(page.body, page.url);
  if (structured) return structured;
  const draft = await readRecipe({ text: pageText(page.body) }, page.url);
  if (!draft) throw new ImportError(NOT_FOUND);
  return draft;
}

/**
 * Turns a link, pasted text or a screenshot into a filled-in recipe form.
 * Nothing is saved here: the member checks the form and shares it themselves.
 */
export async function importRecipe(formData: FormData): Promise<ActionResult<RecipeDraft>> {
  await requireContext();
  const mode = formData.get("mode");
  try {
    if (mode === "link") {
      return { ok: true, data: await fromLink(String(formData.get("url") ?? "")) };
    }
    if (mode === "text") {
      const text = String(formData.get("text") ?? "").trim();
      if (text.length < 20) return { ok: false, error: "Plak de tekst van het recept." };
      // A shared TikTok or site link with only a few words around it is handled as a link.
      const link = firstUrl(text);
      if (link && text.replace(link, "").trim().length < 60) return { ok: true, data: await fromLink(link) };
      const draft = await readRecipe({ text: text.slice(0, IMPORT_TEXT_MAX) }, link && publicUrl(link) ? link : null);
      return draft ? { ok: true, data: draft } : { ok: false, error: "In deze tekst staat geen recept." };
    }
    if (mode === "image") {
      const file = formData.get("image");
      if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Kies een screenshot." };
      const mediaType = IMAGE_TYPES.find((t) => t === file.type);
      if (!mediaType) return { ok: false, error: "Kies een afbeelding (jpg, png of webp)." };
      if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: "Deze afbeelding is te groot." };
      const data = Buffer.from(await file.arrayBuffer()).toString("base64");
      const draft = await readRecipe({ image: { data, mediaType } }, null);
      return draft ? { ok: true, data: draft } : { ok: false, error: "Op deze screenshot staat geen recept dat de app kan lezen." };
    }
    return { ok: false, error: "Kies een link, tekst of screenshot." };
  } catch (err) {
    if (err instanceof ImportError) return { ok: false, error: err.message };
    console.error("recipe import:", err);
    return { ok: false, error: "Importeren lukte niet. Probeer het nog eens." };
  }
}
