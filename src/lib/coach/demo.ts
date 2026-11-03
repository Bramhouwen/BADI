import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppContext } from "@/lib/data";
import type { CoachResult } from "./run";
import type { StoredRef } from "./prompt";
import { executeCoachTool } from "./execute";
import { OFFERS } from "./offer";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Scripted Baddy for demo mode and local testing without an API key. Like the real
 * Baddy it proposes first and saves after a yes, through the real tool executor.
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

  if (/onthoud|ik eet geen|ik ben vegetari|allergisch|blessure/.test(q)) {
    const fact = opts.message.replace(/^(onthoud( dat)?|baddy,?)\s*/i, "").trim().slice(0, 200) || "Voorkeur doorgegeven";
    const outcome = await executeCoachTool("save_memory", { content: fact.charAt(0).toUpperCase() + fact.slice(1) }, opts.supabase, opts.ctx);
    if (outcome.ref) {
      refs.push(outcome.ref);
      opts.onRef?.(outcome.ref);
    }
    reply = "Genoteerd, daar houd ik voortaan rekening mee. Je ziet al mijn notities over jou op je profiel onder **Wat Baddy over mij weet**.";
  } else if (/\bkitchen\b/.test(q) && /^(ja|zet|sla)/.test(q)) {
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
    reply = "Staat in de Kitchen: **Kwarkbowl met appel en kaneel**.";
  } else if (/\bfitness\b/.test(q) && /^(ja|zet|sla)/.test(q)) {
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
    reply = "Je schema staat in Fitness: **Full Body 2x per week**. Workout A en B wissel je af, met 90 seconden rust tussen de sets.";
  } else if (/recept|ontbijt|lunch|avondeten|maaltijd/.test(q)) {
    reply = `Voorstel voor een ontbijt zonder toegevoegde suikers: **Kwarkbowl met appel en kaneel**, ruim 30 gram eiwit.\n\n- 250 g magere kwark\n- 1 appel\n- 30 g havermout\n- 15 g walnoten\n- Kaneel\n\nSnijd de appel in blokjes, meng de havermout door de kwark en top met appel, walnoten en kaneel.\n\n${OFFERS.recipe.question}`;
  } else if (/schema|training|kracht|workout/.test(q)) {
    reply = `Voorstel: **Full Body 2x per week**.\n\n**Full Body A**\n- Squat 3 × 10\n- Bench Press 3 × 10\n- Seated Row 3 × 12\n- Plank 3 × 40 sec\n\n**Full Body B**\n- Romanian Deadlift 3 × 10\n- Shoulder Press 3 × 10\n- Lat Pulldown 3 × 12\n- Lunges 3 × 10\n\n${OFFERS.plan.question}`;
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
