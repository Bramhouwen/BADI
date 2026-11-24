import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { OUTFITS, currentOutfit, defaultOutfit, mayWear, spriteKey } from "@/lib/world/outfits";
import { WORLD_SPRITES } from "@/lib/world/types";
import { ITEMS, ITEM_BY_ID, RACK } from "@/lib/world/items";

describe("outfits", () => {
  it("has frames for every character in every outfit, with the same animations", () => {
    for (const c of WORLD_SPRITES) {
      const base = JSON.parse(fs.readFileSync(`public/wereld/poppetjes/${c}/manifest.json`, "utf8"));
      for (const o of OUTFITS) {
        const m = JSON.parse(fs.readFileSync(`public/wereld/poppetjes/${spriteKey(c, o.id)}/manifest.json`, "utf8"));
        expect(Object.keys(m.animations).sort(), `${c} ${o.id}`).toEqual(Object.keys(base.animations).sort());
        expect(m.zitAnker, `${c} ${o.id}`).toBeTruthy();
      }
    }
  });

  it("names the frames folder after the outfit, the normal clothes are the character itself", () => {
    expect(spriteKey("anne", "standaard")).toBe("anne");
    expect(spriteKey("anne", "goud")).toBe("anne-goud");
  });

  it("keeps the gold tracksuit for the Super Badi", () => {
    expect(mayWear("goud", false)).toBe(false);
    expect(mayWear("goud", true)).toBe(true);
    expect(mayWear("standaard", false)).toBe(true);
    expect(defaultOutfit(true)).toBe("goud");
    expect(defaultOutfit(false)).toBe("standaard");
  });

  it("follows your choice of this week only", () => {
    const week = "2026-11-23";
    // The Super Badi took it off this week.
    expect(currentOutfit({ outfit: "standaard", week }, week, true)).toBe("standaard");
    // A choice from last week does not count: gold again for the new Super Badi.
    expect(currentOutfit({ outfit: "standaard", week: "2026-11-16" }, week, true)).toBe("goud");
    // Gold chosen last week, no longer Super Badi: normal clothes.
    expect(currentOutfit({ outfit: "goud", week }, week, false)).toBe("standaard");
    expect(currentOutfit(null, week, false)).toBe("standaard");
  });
});

describe("clothing rack", () => {
  it("is not for sale but can be drawn", () => {
    expect(ITEMS.some((i) => i.id === RACK.id)).toBe(false);
    expect(ITEM_BY_ID.get(RACK.id)).toBe(RACK);
    expect(fs.existsSync(`public/wereld/meubels/${RACK.id}.webp`)).toBe(true);
  });
});
