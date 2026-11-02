/**
 * Baddy's tools: JSON-schema definitions for the model and Zod schemas that
 * validate every tool input before anything touches the database.
 */
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { RECIPE_CATEGORIES } from "@/lib/constants";

const ACTIVITY_TYPES = ["run", "walk", "cycle", "strength", "hiit", "yoga", "other"] as const;
const MUSCLE_GROUPS = ["legs", "chest", "back", "shoulders", "arms", "core", "cardio", "other"] as const;

export const saveRecipeInput = z.object({
  title: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional(),
  category: z.enum(RECIPE_CATEGORIES),
  ingredients: z.array(z.string().trim().min(1).max(120)).min(1).max(30),
  instructions: z.array(z.string().trim().min(1).max(400)).min(1).max(15),
  protein_grams: z.number().int().min(0).max(300).optional(),
});
export type SaveRecipeInput = z.infer<typeof saveRecipeInput>;

export const createPlanInput = z.object({
  name: z.string().trim().min(1).max(60),
  goal: z.string().trim().max(120).optional(),
  description: z.string().trim().max(500).optional(),
  workouts: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(60),
        activity_type: z.enum(ACTIVITY_TYPES),
        exercises: z
          .array(
            z.object({
              name: z.string().trim().min(1).max(60),
              muscle_group: z.enum(MUSCLE_GROUPS).optional(),
              sets: z.number().int().min(1).max(20),
              reps: z.number().int().min(1).max(500).optional(),
              weight_kg: z.number().min(0).max(1000).optional(),
            }),
          )
          .max(12),
      }),
    )
    .min(1)
    .max(7),
});
export type CreatePlanInput = z.infer<typeof createPlanInput>;

export const saveMemoryInput = z.object({ content: z.string().trim().min(1).max(200) });
export const forgetMemoryInput = z.object({ id: z.string().uuid() });
export const MAX_MEMORIES = 40;

export const COACH_TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "save_recipe",
    description:
      "Zet één recept in de Kitchen van de squad, met Baddy als auteur. Gebruik dit wanneer iemand vraagt om een recept te maken, toe te voegen of op te slaan. Het recept moet voldoen aan de huisregels: geen toegevoegde suikers, whole foods, eiwit bij hoofdmaaltijden.",
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Korte naam van het gerecht, maximaal 80 tekens." },
        description: { type: "string", description: "Eén of twee zinnen: waarom dit lekker of handig is. Maximaal 500 tekens." },
        category: { type: "string", enum: [...RECIPE_CATEGORIES] },
        ingredients: { type: "array", items: { type: "string" }, description: "Eén ingrediënt per item, met hoeveelheid, bijvoorbeeld '200 g magere kwark'." },
        instructions: { type: "array", items: { type: "string" }, description: "Bereidingsstappen in volgorde, kort en concreet." },
        protein_grams: { type: "integer", description: "Geschatte grammen eiwit per portie." },
      },
      required: ["title", "category", "ingredients", "instructions"],
    },
  },
  {
    name: "create_workout_plan",
    description:
      "Maakt een trainingsschema in Fitness voor degene met wie je praat, met één of meer workouts (bijvoorbeeld Full Body A en B). Gebruik dit wanneer iemand vraagt om een schema te maken of op te slaan.",
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Naam van het schema, maximaal 60 tekens." },
        goal: { type: "string", description: "Doel in één korte zin." },
        description: { type: "string", description: "Hoe en hoe vaak je het schema volgt." },
        workouts: {
          type: "array",
          description: "De workouts in het schema, maximaal 7.",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              activity_type: { type: "string", enum: [...ACTIVITY_TYPES] },
              exercises: {
                type: "array",
                description: "Oefeningen, maximaal 12. Leeg laten mag bij cardio.",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string", description: "Bij voorkeur een standaardoefening, exact gespeld." },
                    muscle_group: { type: "string", enum: [...MUSCLE_GROUPS] },
                    sets: { type: "integer" },
                    reps: { type: "integer" },
                    weight_kg: { type: "number", description: "Alleen als je een concreet startgewicht wilt adviseren." },
                  },
                  required: ["name", "sets"],
                },
              },
            },
            required: ["name", "activity_type", "exercises"],
          },
        },
      },
      required: ["name", "workouts"],
    },
  },
  {
    name: "save_memory",
    description:
      "Onthoudt één blijvend feit over degene met wie je praat, zoals een voorkeur, allergie, blessure, doel of beschikbare tijd. Kort, feitelijk, in de derde persoon.",
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: { content: { type: "string", description: "Het feit, maximaal 200 tekens. Bijvoorbeeld: 'Eet geen vis'." } },
      required: ["content"],
    },
  },
  {
    name: "forget_memory",
    description: "Verwijdert een notitie uit je geheugen die niet meer klopt. Gebruik de id tussen blokhaken uit 'Wat je onthoudt over deze persoon'.",
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: { id: { type: "string", description: "De id van de notitie." } },
      required: ["id"],
    },
  },
];

/** Recipe text fields as the app stores them. */
export function recipeRow(input: SaveRecipeInput) {
  return {
    title: input.title,
    description: input.description || null,
    category: input.category,
    ingredients: input.ingredients.join("\n"),
    instructions: input.instructions.map((s, i) => `${i + 1}. ${s}`).join("\n"),
    protein_grams: input.protein_grams ?? null,
  };
}

/** Case- and accent-insensitive key for matching exercise names. */
export function exerciseKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
