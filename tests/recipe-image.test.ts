import { describe, expect, it } from "vitest";
import { ingredientName, recipeImagePrompt } from "@/lib/recipe-image-prompt";

describe("AI recipe photo prompt", () => {
  it("strips amounts and units from ingredients", () => {
    expect(ingredientName("200 g magere kwark")).toBe("magere kwark");
    expect(ingredientName("1 el olijfolie")).toBe("olijfolie");
    expect(ingredientName("½ avocado (rijp)")).toBe("avocado");
    expect(ingredientName("2 tenen knoflook")).toBe("knoflook");
  });

  it("describes the dish in the house style without text or people", () => {
    const p = recipeImagePrompt({ title: "Kip burrito bowl", category: "Avondeten", ingredients: "150 g kipfilet\n100 g zilvervliesrijst\n1 avocado\nzout" });
    expect(p).toContain("of Kip burrito bowl,");
    expect(p).not.toMatch(/"|\btext\b|logo|letter|label/i);
    expect(p).toContain("a dinner dish");
    expect(p).toContain("kipfilet, zilvervliesrijst, avocado, zout");

  });

  it("drops emoji and quotes from the dish name", () => {
    expect(recipeImagePrompt({ title: 'High Protein Pasta 🍝 "deluxe"' })).toContain("of High Protein Pasta deluxe, a home-cooked dish.");
  });

  it("works without ingredients or category", () => {
    expect(recipeImagePrompt({ title: "Overnight oats" })).toContain("a home-cooked dish.");
  });
});

describe("AI photo errors", () => {
  it("turns a gateway error into a short readable reason", async () => {
    const { gatewayReason, RECIPE_IMAGE_MODELS } = await import("@/lib/recipe-image");
    expect(gatewayReason({ statusCode: 402, message: "Payment required", responseBody: JSON.stringify({ error: { message: "Insufficient  credits" } }) })).toBe("402: Insufficient credits");
    expect(gatewayReason(new Error("timeout"))).toBe("timeout");
    expect(gatewayReason(undefined)).toBe("onbekende fout");
    expect(RECIPE_IMAGE_MODELS[0]).toBe("bfl/flux-3-image");
    expect(new Set(RECIPE_IMAGE_MODELS).size).toBe(RECIPE_IMAGE_MODELS.length);
  });
});
