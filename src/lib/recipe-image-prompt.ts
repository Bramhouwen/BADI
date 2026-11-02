/**
 * The instruction for an AI recipe photo. Pure, so the house style stays the
 * same for every recipe and can be tested.
 */

const CATEGORY_HINT: Record<string, string> = {
  Ontbijt: "a breakfast dish",
  Middageten: "a lunch dish",
  Avondeten: "a dinner dish",
  Tussendoortje: "a snack",
};

/** "200 g magere kwark" -> "magere kwark"; drops amounts, units and notes in brackets. */
export function ingredientName(line: string): string {
  return line
    .replace(/\(.*?\)/g, "")
    .replace(/^[\s\d.,/½¼¾-]+/, "")
    .replace(/^(g|gr|gram|kg|ml|l|liter|el|tl|eetlepels?|theelepels?|stuks?|st|blik|blikje|zakje|teen|tenen|snufje|handje|handvol|plak(?:jes)?|bos(?:je)?)\b\.?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function recipeImagePrompt(r: { title: string; category?: string | null; ingredients?: string | null }): string {
  const names = (r.ingredients ?? "")
    .split("\n")
    .map(ingredientName)
    .filter((n) => n.length > 1)
    .slice(0, 6);
  const kind = (r.category && CATEGORY_HINT[r.category]) || "a home-cooked dish";
  return [
    `Appetizing modern food photography of "${r.title}", ${kind}${names.length ? ` made with ${names.join(", ")}` : ""}.`,
    "Plated as you would serve it at home in 2026, generous and fresh, visible texture.",
    "Soft natural daylight from the side, 45 degree angle, shallow depth of field.",
    "Simple matte ceramic plate or bowl on a warm light wood or linen surface, one or two subtle props, warm cream and terracotta tones.",
    "Realistic, true-to-life colours. No text, no logos, no people, no hands.",
  ].join(" ");
}
