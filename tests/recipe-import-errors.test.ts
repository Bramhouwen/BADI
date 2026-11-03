import { describe, expect, it, vi } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { apiReason } from "@/lib/recipe-import-server";

const apiError = (status: number, message: string) => Anthropic.APIError.generate(status, { type: "error", error: { type: "invalid_request_error", message } }, message, new Headers());

describe("recipe import errors", () => {
  it("names the reason a Claude call failed", () => {
    expect(apiReason(apiError(400, "Your credit balance is too low to access the Anthropic API."))).toContain("API-tegoed");
    expect(apiReason(apiError(401, "invalid x-api-key"))).toContain("API-sleutel");
    expect(apiReason(apiError(429, "rate limited"))).toContain("te veel verzoeken");
    expect(apiReason(apiError(400, "tools.0: something odd"))).toMatch(/^Het uitlezen lukte niet \(400: .*something odd/);
    expect(apiReason(new Error("x"))).toBe("Het uitlezen lukte nu niet. Probeer het zo nog eens.");
  });
});

describe("reading a recipe with Claude", () => {
  it("asks for structured output instead of a forced tool and turns the JSON into a draft", async () => {
    const { readRecipe } = await import("@/lib/recipe-import-server");
    const answer = { found: true, title: "Quesadilla", description: "", category: "Ontbijt", ingredients: ["3 eieren", "1 wrap"], instructions: [], protein_grams: 47 };
    let sent: Record<string, unknown> = {};
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      sent = JSON.parse(String(init.body));
      const body = { id: "msg_1", type: "message", role: "assistant", model: sent.model, content: [{ type: "text", text: JSON.stringify(answer) }], stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } };
      return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    });
    try {
      const draft = await readRecipe({ text: "3 eggs, 1 wrap" }, "https://www.tiktok.com/@a/video/1");
      expect(sent.tool_choice).toBeUndefined();
      expect(sent.tools).toBeUndefined();
      expect((sent.output_config as { format?: { type?: string } }).format?.type).toBe("json_schema");
      expect(draft).toMatchObject({ title: "Quesadilla", ingredients: "3 eieren\n1 wrap", instructions: "", category: "Ontbijt", protein_grams: 47 });
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });
});
