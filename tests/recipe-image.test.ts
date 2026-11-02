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
    expect(p).toContain('"Kip burrito bowl"');
    expect(p).toContain("a dinner dish");
    expect(p).toContain("kipfilet, zilvervliesrijst, avocado, zout");
    expect(p).toContain("No text");
  });

  it("works without ingredients or category", () => {
    expect(recipeImagePrompt({ title: "Overnight oats" })).toContain("a home-cooked dish.");
  });
});
