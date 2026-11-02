import Anthropic from "@anthropic-ai/sdk";
import { aiImagesAvailable, generateRecipePhotoFor } from "@/lib/recipe-image";
import { z } from "zod";
import { after } from "next/server";
import { sendPush } from "@/lib/push";
import { getContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { isDemo } from "@/lib/demo";
import { todayKey } from "@/lib/dates";
import { COACH_DAILY_LIMIT, COACH_HISTORY_MESSAGES, contextBlock, feedbackBlock, inspiration, inspirationBlock, kitchenBlock, memoryBlock, parseRefs, refsNote, type StoredRef } from "@/lib/coach/prompt";
import { loadCoachContext, loadCoachExtras } from "@/lib/coach/context";
import { hasCoachKey, runCoach, type CoachTurn } from "@/lib/coach/run";
import { runDemoCoach } from "@/lib/coach/demo";

export type CoachEvent =
  | { type: "status"; status: "thinking" | "working" }
  | { type: "text"; delta: string }
  | { type: "ref"; ref: StoredRef }
  | { type: "done"; id: string | null }
  | { type: "error"; message: string };

const bodySchema = z.object({ message: z.string().trim().min(1, "Typ eerst een vraag.").max(4000, "Maximaal 4000 tekens.") });

function json(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

/** Start of today in the challenge timezone, as an ISO timestamp, for the daily limit. */
function startOfToday(tz: string): string {
  const key = todayKey(new Date(), tz);
  const probe = new Date(`${key}T12:00:00Z`);
  const offsetMin = Math.round((new Date(probe.toLocaleString("en-US", { timeZone: tz })).getTime() - new Date(probe.toLocaleString("en-US", { timeZone: "UTC" })).getTime()) / 60000);
  return new Date(Date.parse(`${key}T00:00:00Z`) - offsetMin * 60000).toISOString();
}

export async function POST(request: Request) {
  const ctx = await getContext();
  if (!ctx) return json(401, "Je bent niet ingelogd.");
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return json(400, parsed.error.issues[0].message);
  const demo = isDemo();
  if (!demo && !hasCoachKey()) return json(503, "Baddy is nog niet gekoppeld. De beheerder moet een Anthropic API-sleutel instellen.");

  const supabase = await createClient();
  const { count } = await supabase
    .from("coach_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", ctx.userId)
    .eq("role", "user")
    .gte("created_at", startOfToday(ctx.challenge.timezone));
  if ((count ?? 0) >= COACH_DAILY_LIMIT) return json(429, `Je hebt vandaag al ${COACH_DAILY_LIMIT} vragen gesteld. Morgen kan het weer.`);

  const [{ data: historyRows }, coachCtx, extras] = await Promise.all([
    supabase.from("coach_messages").select("role, body, refs").eq("user_id", ctx.userId).order("created_at", { ascending: false }).limit(COACH_HISTORY_MESSAGES),
    loadCoachContext(supabase, ctx),
    loadCoachExtras(supabase, ctx, { personal: true }),
  ]);
  const month = Number(todayKey(new Date(), ctx.challenge.timezone).slice(5, 7));
  const dynamicSystem = [contextBlock(coachCtx), memoryBlock(extras.memories), feedbackBlock(extras.feedback), kitchenBlock(extras.kitchen), inspirationBlock(inspiration(month))]
    .filter(Boolean)
    .join("\n\n");
  const { error: insertError } = await supabase.from("coach_messages").insert({ challenge_id: ctx.challenge.id, user_id: ctx.userId, role: "user", body: parsed.data.message });
  if (insertError) return json(500, "Je vraag opslaan is niet gelukt.");

  const history: CoachTurn[] = ((historyRows ?? []) as { role: "user" | "assistant"; body: string; refs: unknown }[])
    .reverse()
    .map((r) => ({ role: r.role, content: r.role === "assistant" ? r.body + refsNote(parseRefs(r.refs)) : r.body }))
    .filter((t) => t.content.trim().length > 0);
  // The API needs the conversation to start with a user turn.
  while (history.length && history[0].role !== "user") history.shift();
  const turns: CoachTurn[] = [...history, { role: "user", content: parsed.data.message }];

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: CoachEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        const result = demo
          ? await runDemoCoach({ supabase, ctx, message: parsed.data.message, onText: (delta) => send({ type: "text", delta }), onRef: (ref) => send({ type: "ref", ref }) })
          : await runCoach({
              supabase,
              ctx,
              turns,
              dynamicSystem,
              effort: "medium",
              onText: (delta) => send({ type: "text", delta }),
              onRef: (ref) => send({ type: "ref", ref }),
              onStatus: (status) => send({ type: "status", status }),
            });
        const { data: saved } = await supabase
          .from("coach_messages")
          .insert({ challenge_id: ctx.challenge.id, user_id: ctx.userId, role: "assistant", body: result.text || "…", refs: result.refs })
          .select("id")
          .single();
        send({ type: "done", id: (saved as { id: string } | null)?.id ?? null });
        for (const ref of result.refs.filter((r) => r.type === "recipe")) {
          after(() => sendPush(supabase, "recipes", { title: "Nieuw recept van Baddy", body: `${ref.name} staat in de Kitchen.`, url: `/kitchen/${ref.id}`, tag: "recipe" }));
          if (aiImagesAvailable()) after(() => generateRecipePhotoFor(supabase, ctx, ref.id));
        }
      } catch (err) {
        const message =
          err instanceof Anthropic.RateLimitError
            ? "Baddy is even druk. Probeer het over een minuut opnieuw."
            : err instanceof Anthropic.AuthenticationError
              ? "De koppeling met Baddy werkt niet: de API-sleutel klopt niet."
              : err instanceof Anthropic.APIError
                ? "Baddy kon je vraag nu niet afmaken. Probeer het opnieuw."
                : "Er ging iets mis. Probeer het opnieuw.";
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
