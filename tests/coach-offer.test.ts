import { describe, expect, it } from "vitest";
import { OFFERS, saveOffer } from "@/lib/coach/offer";

describe("Baddy save offers", () => {
  it("recognises the closing question of a recipe or plan proposal", () => {
    expect(saveOffer(`**Kwarkbowl**\n\n- 250 g kwark\n\n${OFFERS.recipe.question}`)).toBe("recipe");
    expect(saveOffer(`Full Body A en B.\n${OFFERS.plan.question}`)).toBe("plan");
    expect(saveOffer("Zal ik hem in de kitchen zetten?  ")).toBe("recipe");
  });

  it("offers no button for tips, a statement or a choice between several recipes", () => {
    expect(saveOffer("Drink bij elke maaltijd een glas water.")).toBeNull();
    expect(saveOffer("Hij staat in de Kitchen.")).toBeNull();
    expect(saveOffer(OFFERS.recipe.questionMany)).toBeNull();
    expect(saveOffer("Hoe ging je training?")).toBeNull();
  });
});
