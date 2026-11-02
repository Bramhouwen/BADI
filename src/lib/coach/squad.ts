import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppContext } from "@/lib/data";
import { getSquad } from "@/lib/data";
import { isDemo } from "@/lib/demo";
import { firstName } from "@/lib/utils";
import { formatDateNl, todayKey } from "@/lib/dates";
import { SQUAD_COACH_DAILY_LIMIT, inspiration, inspirationBlock, kitchenBlock, squadBlock } from "./prompt";
import { loadCoachExtras } from "./context";
import { sendPush } from "@/lib/push";
import { COACH_TOOLS } from "./tools";
import { hasCoachKey, runCoach } from "./run";
import { runDemoCoach } from "./demo";

/**
 * Baddy answers in the squad chat after someone tagged @Baddy. Runs after the
 * sender's request has finished (next/server `after`), with the sender's session.
 */
export async function replyAsBaddyInSquad(supabase: SupabaseClient, ctx: AppContext, askerBody: string): Promise<void> {
  const insert = (body: string, recipeId?: string, recipeName?: string) =>
    supabase.from("squad_messages").insert({
      challenge_id: ctx.challenge.id,
      user_id: ctx.userId,
      body,
      mentions: [],
      is_coach: true,
      attachment_type: recipeId ? "recipe" : null,
      ref_id: recipeId ?? null,
      attachment_name: recipeName ?? null,
    });

  const dayStart = `${todayKey(new Date(), ctx.challenge.timezone)}T00:00:00`;
  const { count } = await supabase
    .from("squad_messages")
    .select("id", { count: "exact", head: true })
    .eq("challenge_id", ctx.challenge.id)
    .eq("is_coach", true)
    .gte("created_at", dayStart);
  if ((count ?? 0) >= SQUAD_COACH_DAILY_LIMIT) {
    await insert("Ik heb vandaag al veel meegepraat in de groep. Stel je vraag gerust in je eigen gesprek met mij.");
    return;
  }

  if (!isDemo() && !hasCoachKey()) {
    await insert("Ik ben nog niet gekoppeld. Vraag de beheerder om een Anthropic API-sleutel in te stellen.");
    return;
  }

  try {
    let result;
    if (isDemo()) {
      result = await runDemoCoach({ supabase, ctx, message: askerBody, squad: true });
    } else {
      const [squad, { data: rows }, extras] = await Promise.all([
        getSquad(ctx.challenge.id),
        supabase.from("squad_messages").select("user_id, body, is_coach, attachment_type, attachment_name").eq("challenge_id", ctx.challenge.id).order("created_at", { ascending: false }).limit(20),
        loadCoachExtras(supabase, ctx, { personal: false }),
      ]);
      const nameOf = (id: string) => firstName(squad.find((m) => m.user_id === id)?.profile.display_name ?? "Iemand");
      const transcript = ((rows ?? []) as { user_id: string; body: string; is_coach: boolean; attachment_type: string | null; attachment_name: string | null }[])
        .reverse()
        .map((r) => {
          const who = r.is_coach ? "Baddy" : nameOf(r.user_id);
          const extra = r.attachment_type ? ` [${r.attachment_type === "recipe" ? "recept" : r.attachment_type === "post" ? "Wall-foto" : "bijlage"}${r.attachment_name ? `: ${r.attachment_name}` : ""}]` : "";
          return `${who}: ${r.body}${extra}`.trim();
        })
        .join("\n");
      const asker = firstName(ctx.profile.display_name);
      result = await runCoach({
        supabase,
        ctx,
        turns: [{ role: "user", content: `Groepschat:\n${transcript}\n\nBeantwoord het laatste bericht van ${asker} aan jou.` }],
        dynamicSystem: [
          squadBlock(asker, formatDateNl(todayKey(new Date(), ctx.challenge.timezone), { weekday: "long", day: "numeric", month: "long" })),
          kitchenBlock(extras.kitchen),
          inspirationBlock(inspiration(Number(todayKey(new Date(), ctx.challenge.timezone).slice(5, 7)))),
        ].join("\n\n"),
        effort: "low",
        tools: COACH_TOOLS.filter((t) => t.name === "save_recipe" || t.name === "create_workout_plan"),
      });
    }
    const recipe = result.refs.find((r) => r.type === "recipe");
    const planNote = result.refs.filter((r) => r.type === "plan").map((r) => `Schema "${r.name}" staat in Fitness.`).join(" ");
    const body = [result.text, planNote].filter(Boolean).join("\n\n").slice(0, 1000) || "…";
    await insert(body, recipe?.id, recipe?.name);
    await sendPush(supabase, "chat", { title: "Baddy in de squad", body: body.slice(0, 160), url: "/squad", tag: "squad-chat" });
    if (recipe) await sendPush(supabase, "recipes", { title: "Nieuw recept van Baddy", body: `${recipe.name} staat in de Kitchen.`, url: `/kitchen/${recipe.id}`, tag: "recipe" });
  } catch {
    await insert("Ik kon even niet antwoorden. Probeer het zo nog eens.");
  }
}
