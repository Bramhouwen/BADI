import { describe, expect, it } from "vitest";
import { extractAppLinks } from "@/lib/app-links";
import { TOUR_STEPS, TOUR_URL, WORLD_TOUR } from "@/lib/world/tour";

describe("rondleiding World of Badi", () => {
  it("wijst alleen naar knoppen die een data-tour hebben", () => {
    const known = new Set(["zeg", "status", "acties", "kaart", "missies", "postvak", "munten"]);
    for (const s of TOUR_STEPS) if (s.target) expect(known.has(s.target)).toBe(true);
  });
  it("Baddy's bericht krijgt een knop naar de wereld", () => {
    const { links, text } = extractAppLinks(WORLD_TOUR.chat);
    expect(links).toEqual([{ href: "/wereld", label: "Naar World of Badi" }]);
    expect(text).not.toContain("/wereld");
  });
  it("de melding opent de rondleiding", () => {
    expect(TOUR_URL).toBe("/wereld?rondleiding=1");
  });
});
