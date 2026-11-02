import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppContext } from "@/lib/data";

describe("@Baddy in the squad chat (demo database)", () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_WINTER_ARC_DEMO = "1";
  });

  it("posts a reply marked as Baddy, under the member who asked", async () => {
    const { createDemoClient } = await import("@/lib/demo/mock-client");
    const { DEMO_CHALLENGE_ID, DEMO_USER_ID } = await import("@/lib/demo");
    const { replyAsBaddyInSquad } = await import("@/lib/coach/squad");
    const { asSender, BADDY_ID } = await import("@/lib/chat");
    const supabase = createDemoClient() as unknown as SupabaseClient;
    const ctx = { userId: DEMO_USER_ID, challenge: { id: DEMO_CHALLENGE_ID, timezone: "Europe/Amsterdam" }, profile: { display_name: "Bram" } } as unknown as AppContext;

    await replyAsBaddyInSquad(supabase, ctx, "@Baddy hoe drink ik meer water?");

    const { data } = await supabase.from("squad_messages").select("*").eq("is_coach", true);
    const rows = (data ?? []) as { user_id: string; body: string; is_coach: boolean }[];
    expect(rows.length).toBeGreaterThan(0);
    const reply = rows[rows.length - 1];
    expect(reply.user_id).toBe(DEMO_USER_ID);
    expect(reply.body).toMatch(/liter/);
    expect(asSender(reply as never).user_id).toBe(BADDY_ID);
  });
});
