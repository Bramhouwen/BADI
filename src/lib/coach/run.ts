import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppContext } from "@/lib/data";
import { BADDY_MODEL, BADDY_SYSTEM, type StoredRef } from "./prompt";
import { COACH_TOOLS } from "./tools";
import { executeCoachTool } from "./execute";

export interface CoachTurn {
  role: "user" | "assistant";
  content: string;
}

export interface CoachRunOptions {
  supabase: SupabaseClient;
  ctx: AppContext;
  /** Earlier turns plus the new user message, oldest first, ending with a user turn. */
  turns: CoachTurn[];
  /** Volatile instructions (personal context, squad situation) after the cached prefix. */
  dynamicSystem: string;
  effort: "low" | "medium";
  /** Tool set; defaults to all coach tools. The squad chat leaves out the personal memory tools. */
  tools?: Anthropic.Beta.BetaTool[];
  onText?: (delta: string) => void;
  onRef?: (ref: StoredRef) => void;
  onStatus?: (status: "thinking" | "working") => void;
}

export interface CoachResult {
  text: string;
  refs: StoredRef[];
  refused: boolean;
}

const MAX_ROUNDS = 5;
const REFUSAL_TEXT = "Daar kan ik je niet mee helpen. Stel je vraag gerust anders, of vraag me iets over voeding, training of je routine.";

export function hasCoachKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * One coach turn: streams text, executes tools, loops until Baddy is done.
 * Thinking and tool blocks from this turn are passed back unchanged (append-only).
 */
export async function runCoach(opts: CoachRunOptions): Promise<CoachResult> {
  const client = new Anthropic();
  const messages: Anthropic.Beta.BetaMessageParam[] = opts.turns.map((t) => ({ role: t.role, content: t.content }));
  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: "text", text: BADDY_SYSTEM, cache_control: { type: "ephemeral" } },
    { type: "text", text: opts.dynamicSystem },
  ];
  const refs: StoredRef[] = [];
  let text = "";
  let jsonRetries = 0;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    opts.onStatus?.(round === 0 ? "thinking" : "working");
    const stream = client.beta.messages.stream({
      model: BADDY_MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: opts.effort },
      system,
      tools: opts.tools ?? COACH_TOOLS,
      messages,
    });
    let roundText = "";
    stream.on("text", (delta) => {
      roundText += delta;
      opts.onText?.(delta);
    });

    let message: Anthropic.Beta.BetaMessage;
    try {
      message = await stream.finalMessage();
      jsonRetries = 0;
    } catch (err) {
      // Only an unparseable tool input is retried; API errors go to the caller.
      if (err instanceof Anthropic.APIError || jsonRetries++ >= 2) throw err;
      continue;
    }

    if (message.stop_reason === "refusal") {
      const note = (text || roundText ? "\n\n" : "") + REFUSAL_TEXT;
      opts.onText?.(note);
      text += roundText + note;
      return { text: text.trim(), refs, refused: true };
    }
    text += roundText;

    if (message.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: message.content });
      continue;
    }

    const toolUses = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (toolUses.length === 0) break;
    if (message.stop_reason === "max_tokens") break; // never run a tool on a truncated input

    messages.push({ role: "assistant", content: message.content });
    opts.onStatus?.("working");
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const use of toolUses) {
      const outcome = await executeCoachTool(use.name, use.input, opts.supabase, opts.ctx);
      if (outcome.ref) {
        refs.push(outcome.ref);
        opts.onRef?.(outcome.ref);
      }
      results.push({ type: "tool_result", tool_use_id: use.id, content: outcome.content, is_error: outcome.isError || undefined });
    }
    messages.push({ role: "user", content: results });
    if (text && !/\s$/.test(text)) {
      text += "\n\n";
      opts.onText?.("\n\n");
    }
  }

  return { text: text.trim(), refs, refused: false };
}
