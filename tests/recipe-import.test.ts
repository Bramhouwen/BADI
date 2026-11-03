import { describe, expect, it } from "vitest";
import { categoryFrom, decodeEntities, draftFromRead, firstUrl, isTikTok, pageText, publicUrl, recipeFromHtml, sourceLabel, tiktokDescFromHtml } from "@/lib/recipe-import";

const ld = (data: unknown) => `<html><head><script type="application/ld+json">${JSON.stringify(data)}</script></head><body></body></html>`;

describe("recipe import", () => {
  it("only fetches public web addresses", () => {
    expect(publicUrl("https://www.leukerecepten.nl/recepten/shakshuka/")?.hostname).toBe("www.leukerecepten.nl");
    for (const bad of ["ftp://x.nl/a", "http://localhost:3000", "http://127.0.0.1/", "http://10.0.0.1/", "http://[::1]/", "http://router.local/", "https://user:pw@x.nl/", "https://x.nl:8080/", "geen link"]) {
      expect(publicUrl(bad)).toBeNull();
    }
  });

  it("finds the link in a share message and recognises TikTok", () => {
    expect(firstUrl("Kijk deze! https://vm.tiktok.com/ZMabc123/ #recept")).toBe("https://vm.tiktok.com/ZMabc123/");
    expect(firstUrl("(zie https://x.nl/a).")).toBe("https://x.nl/a");
    expect(isTikTok(new URL("https://vm.tiktok.com/ZMabc/"))).toBe(true);
    expect(isTikTok(new URL("https://nottiktok.com/"))).toBe(false);
    expect(sourceLabel("https://www.leukerecepten.nl/recepten/x")).toBe("leukerecepten.nl");
  });

  it("takes over schema.org recipe data without changes", () => {
    const html = ld({
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "WebPage", name: "Pagina" },
        {
          "@type": ["Recipe"],
          name: "Shakshuka &amp; feta",
          description: "<p>Snel en makkelijk.</p>",
          recipeCategory: "Ontbijt",
          recipeIngredient: ["4 eieren", " 1 blik tomaten "],
          recipeInstructions: [
            { "@type": "HowToSection", name: "Saus", itemListElement: [{ "@type": "HowToStep", text: "Fruit de ui." }, { "@type": "HowToStep", text: "Voeg tomaten toe." }] },
            { "@type": "HowToStep", text: "Breek de eieren erin." },
          ],
          nutrition: { proteinContent: "24,4 g" },
        },
      ],
    });
    expect(recipeFromHtml(html, "https://x.nl/r")).toEqual({
      title: "Shakshuka & feta",
      description: "Snel en makkelijk.",
      ingredients: "4 eieren\n1 blik tomaten",
      instructions: "1. Fruit de ui.\n2. Voeg tomaten toe.\n3. Breek de eieren erin.",
      category: "Ontbijt",
      protein_grams: 24,
      source_url: "https://x.nl/r",
    });
  });

  it("handles instructions as one string and skips pages without a recipe", () => {
    const r = recipeFromHtml(ld({ "@type": "Recipe", name: "Wrap", recipeIngredient: ["1 wrap"], recipeInstructions: "Beleg de wrap.\nRol op." }), "https://x.nl");
    expect(r?.instructions).toBe("1. Beleg de wrap.\n2. Rol op.");
    expect(r?.category).toBe("");
    expect(recipeFromHtml(ld({ "@type": "Article", name: "Nieuws" }), "https://x.nl")).toBeNull();
    expect(recipeFromHtml("<script type='application/ld+json'>{kapot</script>", "https://x.nl")).toBeNull();
  });

  it("maps categories on whole words", () => {
    expect(categoryFrom("Hoofdgerecht")).toBe("Avondeten");
    expect(categoryFrom(["snack", "zoet"])).toBe("Tussendoortje");
    expect(categoryFrom("remains of the day")).toBe("");
  });

  it("reduces a page to readable text", () => {
    const text = pageText('<html><head><title>Pasta &amp; pesto</title><meta name="description" content="Lekker snel"></head><body><nav>Menu</nav><script>var x=1</script><p>200 g pasta</p><li>1 pot pesto</li></body></html>');
    expect(text).toContain("Pasta & pesto");
    expect(text).toContain("Lekker snel");
    expect(text).toContain("200 g pasta");
    expect(text).not.toContain("Menu");
    expect(text).not.toContain("var x");
    expect(decodeEntities("&#39;t &#x2019;")).toBe("'t ’");
  });

  it("turns what the AI read into a form draft, and nothing when there was no recipe", () => {
    expect(draftFromRead({ found: false, title: "Pasta" }, null)).toBeNull();
    expect(draftFromRead({ found: true, title: "Pasta", ingredients: [], instructions: [] }, null)).toBeNull();
    const d = draftFromRead({ found: true, title: "Pasta pesto 🍝", category: "Diner", ingredients: ["200 g pasta"], instructions: ["1. Kook de pasta.", "Meng met pesto."], protein_grams: 999 }, "https://www.tiktok.com/@a/video/1");
    expect(d).toMatchObject({ ingredients: "200 g pasta", instructions: "1. Kook de pasta.\n2. Meng met pesto.", category: "", protein_grams: null, source_url: "https://www.tiktok.com/@a/video/1" });
  });

  it("reads the caption from a TikTok video page", () => {
    const data = { __DEFAULT_SCOPE__: { "webapp.video-detail": { itemInfo: { itemStruct: { id: "1", desc: "Quesadilla 🌯 Ingredients: 3 eggs, 1 wrap </script>" } } } } };
    const page = `<html><script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">${JSON.stringify(data).replace(/<\//g, "\\u003c/")}</script></html>`;
    expect(tiktokDescFromHtml(page)).toBe("Quesadilla 🌯 Ingredients: 3 eggs, 1 wrap </script>");
    expect(tiktokDescFromHtml('<script>{"desc":"Pasta \\"pesto\\" 200 g"}</script>')).toBe('Pasta "pesto" 200 g');
    expect(tiktokDescFromHtml("<html></html>")).toBe("");
  });
});
