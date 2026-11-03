import { describe, expect, it } from "vitest";
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
