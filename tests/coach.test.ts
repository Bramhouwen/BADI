import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BADDY_SYSTEM, contextBlock, mentionsBaddy, parseRefs, refsNote, type CoachContext } from "@/lib/coach/prompt";
import { createPlanInput, exerciseKey, recipeRow, saveRecipeInput } from "@/lib/coach/tools";
import { parseBlocks } from "@/components/coach/rich-text";
import { executeCoachTool } from "@/lib/coach/execute";
import { createDemoClient } from "@/lib/demo/mock-client";
import { DEMO_CHALLENGE_ID, DEMO_USER_ID } from "@/lib/demo";
import type { AppContext } from "@/lib/data";

const baseCtx: CoachContext = {
  firstName: "Bram",
  today: "12 november 2026",
  weekday: "donderdag",
  challengeDay: 12,
  challengeLength: 61,
  checkedInToday: true,
  todayActivities: ["Bewogen", "Goed gehydrateerd"],
  streak: 5,
  longestStreak: 9,
  daysCheckedIn: 10,
  waterTodayMl: 1750,
  waterGoalMl: 2500,
  workoutsThisWeek: 2,
  minutesThisWeek: 85,
  kmThisWeek: 5.2,
  recentWorkouts: [{ date: "wo 11 nov", type: "Hardlopen", minutes: 31, km: 5.2 }],
  alcoholExceptionsUsed: 1,
};

describe("Baddy prompt", () => {
  it("contains the house rules and never an em-dash", () => {
    expect(BADDY_SYSTEM).toContain("Geen toegevoegde suikers");
    expect(BADDY_SYSTEM).toContain("10.000 stappen");
    expect(BADDY_SYSTEM).not.toMatch(/—/);
  });

  it("renders personal context with Dutch number formatting", () => {
    const block = contextBlock(baseCtx);
    expect(block).toContain("Naam: Bram");
    expect(block).toContain("dag 12 van 61");
    expect(block).toContain("1,75 liter van 2,5 liter");
    expect(block).toContain("Hardlopen, 31 min, 5,2 km");
    expect(block).toContain("1 van 2");
  });

  it("detects @Baddy at word boundaries only", () => {
    expect(mentionsBaddy("@Baddy wat eet ik vanavond?")).toBe(true);
    expect(mentionsBaddy("Hoi @baddy!")).toBe(true);
    expect(mentionsBaddy("mail@baddy.nl")).toBe(false);
    expect(mentionsBaddy("@Baddyfan")).toBe(false);
  });

  it("parses stored refs defensively and notes them for the next turn", () => {
    const refs = parseRefs([{ type: "recipe", id: "r1", name: "Kwarkbowl" }, { type: "x", id: 1 }, null]);
    expect(refs).toEqual([{ type: "recipe", id: "r1", name: "Kwarkbowl" }]);
    expect(refsNote(refs)).toContain('recept "Kwarkbowl"');
    expect(refsNote([])).toBe("");
  });
});

describe("tool input validation", () => {
  it("accepts a complete recipe and formats it for the Kitchen", () => {
    const parsed = saveRecipeInput.parse({ title: "Linzen dahl", category: "Avondeten", ingredients: ["200 g rode linzen", "1 ui"], instructions: ["Fruit de ui.", "Kook de linzen gaar."], protein_grams: 24 });
    const row = recipeRow(parsed);
    expect(row.ingredients).toBe("200 g rode linzen\n1 ui");
    expect(row.instructions).toBe("1. Fruit de ui.\n2. Kook de linzen gaar.");
    expect(row.description).toBeNull();
  });

  it("rejects unknown categories, empty lists and too many workouts", () => {
    expect(saveRecipeInput.safeParse({ title: "X", category: "Dessert", ingredients: ["a"], instructions: ["b"] }).success).toBe(false);
    expect(saveRecipeInput.safeParse({ title: "X", category: "Ontbijt", ingredients: [], instructions: ["b"] }).success).toBe(false);
    const workout = { name: "W", activity_type: "strength", exercises: [] };
    expect(createPlanInput.safeParse({ name: "P", workouts: Array(8).fill(workout) }).success).toBe(false);
    expect(createPlanInput.safeParse({ name: "P", workouts: [workout] }).success).toBe(true);
  });

  it("matches exercise names regardless of case, accents and punctuation", () => {
    expect(exerciseKey("Bent-over Row")).toBe(exerciseKey("bent over row"));
    expect(exerciseKey(" Push-up ")).toBe("push up");
  });
});

describe("rich text", () => {
  it("splits paragraphs, bullets and numbered lists", () => {
    const blocks = parseBlocks("Intro **vet**\n\n- een\n- twee\n\n1. stap\n2. stap");
    expect(blocks.map((b) => b.kind)).toEqual(["p", "ul", "ol"]);
  });
});

describe("tool execution (demo database)", () => {
  const supabase = createDemoClient() as unknown as SupabaseClient;
  const ctx = { userId: DEMO_USER_ID, challenge: { id: DEMO_CHALLENGE_ID } } as unknown as AppContext;

  it("saves a recipe as Baddy and returns a reference", async () => {
    const out = await executeCoachTool("save_recipe", { title: "Test bowl", category: "Ontbijt", ingredients: ["kwark"], instructions: ["mengen"] }, supabase, ctx);
    expect(out.isError).toBeUndefined();
    expect(out.ref?.type).toBe("recipe");
    const { data } = await supabase.from("recipes").select("*").eq("id", out.ref!.id).maybeSingle();
    expect((data as { by_coach: boolean; image_path: string | null }).by_coach).toBe(true);
    expect((data as { image_path: string | null }).image_path).toBeNull();
  });

  it("returns an error result and writes nothing on invalid input", async () => {
    const out = await executeCoachTool("save_recipe", { title: "" }, supabase, ctx);
    expect(out.isError).toBe(true);
    expect(out.ref).toBeUndefined();
  });

  it("creates a plan with templates and adds unknown exercises as custom ones", async () => {
    const out = await executeCoachTool(
      "create_workout_plan",
      { name: "Testschema", workouts: [{ name: "A", activity_type: "strength", exercises: [{ name: "squat", sets: 3, reps: 8 }, { name: "Kettlebell Swing", muscle_group: "legs", sets: 3, reps: 15 }] }] },
      supabase,
      ctx,
    );
    expect(out.ref?.type).toBe("plan");
    const result = JSON.parse(out.content) as { new_custom_exercises: string[] };
    expect(result.new_custom_exercises).toEqual(["Kettlebell Swing"]);
    const { data: templates } = await supabase.from("workout_templates").select("id").eq("plan_id", out.ref!.id);
    expect(templates).toHaveLength(1);
    const { data: items } = await supabase.from("template_exercises").select("exercise_id").eq("template_id", (templates as { id: string }[])[0].id);
    expect(items).toHaveLength(2);
  });

  it("refuses unknown tools", async () => {
    const out = await executeCoachTool("delete_everything", {}, supabase, ctx);
    expect(out.isError).toBe(true);
  });
});
