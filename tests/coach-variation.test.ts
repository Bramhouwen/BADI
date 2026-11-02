import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BADDY_SYSTEM, feedbackBlock, inspiration, inspirationBlock, kitchenBlock, memoryBlock, parseRefs, refsNote, snippet } from "@/lib/coach/prompt";
import { executeCoachTool } from "@/lib/coach/execute";
import { MAX_MEMORIES } from "@/lib/coach/tools";
import { createDemoClient } from "@/lib/demo/mock-client";
import { DEMO_CHALLENGE_ID, DEMO_USER_ID } from "@/lib/demo";
import type { AppContext } from "@/lib/data";

function seeded(seed: number) {
  let x = seed;
  return () => {
    x = (x * 16807) % 2147483647;
    return (x - 1) / 2147483646;
  };
}

describe("inspiration", () => {
  it("picks distinct angles and seasonal produce for the month", () => {
    const i = inspiration(11, seeded(7));
    expect(new Set(i.cuisines).size).toBe(2);
    expect(new Set(i.proteins).size).toBe(3);
    expect(i.seasonal.every((p) => ["pompoen", "boerenkool", "spruitjes", "knolselderij", "pastinaak", "stoofperen", "paddenstoelen"].includes(p))).toBe(true);
    expect(inspirationBlock(i)).toContain("Seizoensproduct");
  });

  it("varies between requests", () => {
    const a = inspiration(11, seeded(1));
    const b = inspiration(11, seeded(99));
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });
});

describe("context blocks", () => {
  it("summarises the Kitchen with counts and favourites", () => {
    const block = kitchenBlock([
      { title: "Linzen dahl", category: "Avondeten", byCoach: true, reactions: 3, favorite: false },
      { title: "Kwarkbowl", category: "Ontbijt", byCoach: false, reactions: 0, favorite: true },
      { title: "Eiwitwrap", category: "Avondeten", byCoach: false, reactions: 0, favorite: false },
    ]);
    expect(block).toContain("Recepten in de Kitchen (3)");
    expect(block).toContain("Avondeten 2");
    expect(block).toContain("Linzen dahl (Avondeten) [van jou]");
    expect(block).toMatch(/Favoriet of veel reacties: Kwarkbowl; Linzen dahl/);
    expect(kitchenBlock([])).toContain("nog leeg");
  });

  it("lists memories with ids and feedback with ratings", () => {
    expect(memoryBlock([{ id: "m1", content: "Eet geen vis" }])).toContain("- [m1] Eet geen vis");
    expect(memoryBlock([])).toContain("Nog niets");
    expect(feedbackBlock([{ rating: -1, snippet: "Doe 100 burpees" }])).toContain('Duim omlaag: "Doe 100 burpees"');
    expect(feedbackBlock([])).toBe("");
  });

  it("shortens answers to one line for feedback", () => {
    expect(snippet("Drie **tips**:\n\n- water\n- slaap", 200)).toBe("Drie tips: - water - slaap");
    expect(snippet("a".repeat(300)).length).toBe(110);
  });

  it("keeps memory refs and notes them", () => {
    const refs = parseRefs([{ type: "memory", id: "m1", name: "Eet geen vis" }]);
    expect(refs).toHaveLength(1);
    expect(refsNote(refs)).toContain('onthouden: "Eet geen vis"');
  });

  it("tells Baddy to vary and to use her memory", () => {
    expect(BADDY_SYSTEM).toContain("# Variatie");
    expect(BADDY_SYSTEM).toContain("save_memory");
    expect(BADDY_SYSTEM).not.toMatch(/—/);
  });
});

describe("memory tools (demo database)", () => {
  const supabase = createDemoClient() as unknown as SupabaseClient;
  const ctx = { userId: DEMO_USER_ID, challenge: { id: DEMO_CHALLENGE_ID } } as unknown as AppContext;

  it("saves and forgets a memory", async () => {
    const saved = await executeCoachTool("save_memory", { content: "Eet geen vis" }, supabase, ctx);
    expect(saved.ref?.type).toBe("memory");
    const forgot = await executeCoachTool("forget_memory", { id: saved.ref!.id }, supabase, ctx);
    expect(forgot.isError).toBeUndefined();
    const { data } = await supabase.from("coach_memories").select("id").eq("id", saved.ref!.id);
    expect(data).toEqual([]);
  });

  it("refuses empty notes and stops at the limit", async () => {
    expect((await executeCoachTool("save_memory", { content: " " }, supabase, ctx)).isError).toBe(true);
    for (let i = 0; i < MAX_MEMORIES; i++) await executeCoachTool("save_memory", { content: `Feit ${i}` }, supabase, ctx);
    const over = await executeCoachTool("save_memory", { content: "Te veel" }, supabase, ctx);
    expect(over.isError).toBe(true);
    expect(over.content).toContain("vol");
  });
});
