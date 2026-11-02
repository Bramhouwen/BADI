import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppContext } from "@/lib/data";
import type { CoachResult } from "./run";
import type { StoredRef } from "./prompt";
import { executeCoachTool } from "./execute";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Scripted Baddy for demo mode and local testing without an API key. It goes
 * through the real tool executor, so saving recipes and plans is exercised.
 */
export async function runDemoCoach(opts: {
  supabase: SupabaseClient;
  ctx: AppContext;
  message: string;
  squad?: boolean;
  onText?: (delta: string) => void;
  onRef?: (ref: StoredRef) => void;
}): Promise<CoachResult> {
  const q = opts.message.toLowerCase();
  const refs: StoredRef[] = [];
  let reply: string;

  if (/recept|ontbijt|lunch|avondeten|maaltijd/.test(q)) {
    const outcome = await executeCoachTool(
      "save_recipe",
      {
        title: "Kwarkbowl met appel en kaneel",
        description: "Snel ontbijt met ruim 30 gram eiwit, zoet door de appel zelf.",
        category: "Ontbijt",
        ingredients: ["250 g magere kwark", "1 appel", "30 g havermout", "15 g walnoten", "Kaneel"],
        instructions: ["Snijd de appel in blokjes.", "Schep de kwark in een kom en meng de havermout erdoor.", "Top met appel, walnoten en kaneel."],
        protein_grams: 32,
      },
      opts.supabase,
      opts.ctx,
    );
    if (outcome.ref) {
      refs.push(outcome.ref);
      opts.onRef?.(outcome.ref);
    }
    reply = "Ik heb een ontbijt zonder toegevoegde suikers in de Kitchen gezet: **Kwarkbowl met appel en kaneel**.\n\n- Ruim 30 gram eiwit per portie\n- Zoet door de appel, niet door suiker of honing\n- Klaar in vijf minuten";
  } else if (/schema|training|kracht|workout/.test(q)) {
    const outcome = await executeCoachTool(
      "create_workout_plan",
      {
        name: "Full Body 2x per week",
        goal: "Sterker worden met twee korte sessies",
        workouts: [
          { name: "Full Body A", activity_type: "strength", exercises: [{ name: "Squat", sets: 3, reps: 10 }, { name: "Bench Press", sets: 3, reps: 10 }, { name: "Seated Row", sets: 3, reps: 12 }, { name: "Plank", sets: 3, reps: 40 }] },
          { name: "Full Body B", activity_type: "strength", exercises: [{ name: "Romanian Deadlift", sets: 3, reps: 10 }, { name: "Shoulder Press", sets: 3, reps: 10 }, { name: "Lat Pulldown", sets: 3, reps: 12 }, { name: "Lunges", sets: 3, reps: 10 }] },
        ],
      },
      opts.supabase,
      opts.ctx,
    );
    if (outcome.ref) {
      refs.push(outcome.ref);
      opts.onRef?.(outcome.ref);
    }
    reply = "Je schema staat in Fitness: **Full Body 2x per week**.\n\n- Workout A en B wisselen elkaar af\n- Drie sets per oefening, rust 90 seconden\n- Gaat het makkelijk, verhoog dan volgende keer het gewicht een stap";
  } else if (/water|drinken|liter/.test(q)) {
    reply = "Drie dingen die het makkelijker maken:\n\n- Zet bij het opstaan direct een groot glas klaar en drink het leeg\n- Koppel een glas aan vaste momenten: bij elke maaltijd en na elke training\n- Houd een fles van 750 ml bij je, dan zit je met vier vullingen op 3 liter";
  } else {
    reply = opts.squad
      ? "Ik lees mee. Stel je vraag gerust, dan denk ik met jullie mee."
      : "Ik ben Baddy, jullie coach. Vraag me om recepten zonder toegevoegde suikers, een trainingsschema of tips voor water, slaap en stappen.";
  }

  await wait(300);
  for (const word of reply.split(/(\s+)/)) {
    opts.onText?.(word);
    await wait(12);
  }
  return { text: reply, refs, refused: false };
}
