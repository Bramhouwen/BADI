import { describe, expect, it } from "vitest";
import { conversationOf, dmKey, groupReactions, inConversation, previewLine, readByPeer, summarize, typingLabel } from "@/lib/conversations";
import type { ChatMessage } from "@/lib/chat";

const ME = "me";
const msg = (id: string, user_id: string, recipient_id: string | null, created_at: string, body = "hoi"): ChatMessage => ({ id, user_id, recipient_id, created_at, body });

describe("conversations", () => {
  it("puts group messages in the squad chat and private ones with the other person", () => {
    expect(conversationOf(msg("1", "sam", null, "t"), ME)).toBe("squad");
    expect(conversationOf(msg("2", "sam", ME, "t"), ME)).toBe(dmKey("sam"));
    expect(conversationOf(msg("3", ME, "alex", "t"), ME)).toBe(dmKey("alex"));
    expect(inConversation(msg("2", "sam", ME, "t"), ME, "sam")).toBe(true);
    expect(inConversation(msg("2", "sam", ME, "t"), ME, null)).toBe(false);
  });

  it("summarizes last message and unread count per conversation", () => {
    const list = [
      msg("1", "sam", null, "2026-11-02T08:00:00Z"),
      msg("2", ME, null, "2026-11-02T08:05:00Z"),
      msg("3", "sam", ME, "2026-11-02T09:00:00Z"),
      msg("4", "sam", ME, "2026-11-02T09:10:00Z"),
      msg("5", ME, "sam", "2026-11-02T09:20:00Z"),
      msg("6", "alex", null, "2026-11-02T10:00:00Z"),
    ];
    const s = summarize(list, ME, { squad: "2026-11-02T08:30:00Z", [dmKey("sam")]: "2026-11-02T09:05:00Z" });
    expect(s.get("squad")).toEqual({ last: list[5], unread: 1 });
    expect(s.get(dmKey("sam"))).toEqual({ last: list[4], unread: 1 });
  });

  it("counts everything as unread for a conversation never opened", () => {
    const s = summarize([msg("1", "sam", ME, "2026-11-02T08:00:00Z"), msg("2", "sam", ME, "2026-11-02T08:01:00Z")], ME, {});
    expect(s.get(dmKey("sam"))?.unread).toBe(2);
  });

  it("shows read ticks once the other person opened the chat after the message", () => {
    expect(readByPeer({ created_at: "2026-11-02T09:00:00Z" }, "2026-11-02T09:00:01Z")).toBe(true);
    expect(readByPeer({ created_at: "2026-11-02T09:00:00Z" }, "2026-11-02T08:59:59Z")).toBe(false);
    expect(readByPeer({ created_at: "2026-11-02T09:00:00Z" }, null)).toBe(false);
  });
});

describe("reactions", () => {
  it("counts per emoji, marks my own and ignores duplicates", () => {
    const r = groupReactions(
      [
        { message_id: "m", user_id: "sam", emoji: "🔥" },
        { message_id: "m", user_id: ME, emoji: "👍" },
        { message_id: "m", user_id: "alex", emoji: "🔥" },
        { message_id: "m", user_id: "alex", emoji: "🔥" },
      ],
      ME,
    );
    expect(r.m).toEqual([
      { emoji: "🔥", count: 2, mine: false, users: ["sam", "alex"] },
      { emoji: "👍", count: 1, mine: true, users: [ME] },
    ]);
  });
});

describe("chat list texts", () => {
  it("describes who is typing", () => {
    expect(typingLabel([])).toBeNull();
    expect(typingLabel(["Sam"])).toBe("Sam typt…");
    expect(typingLabel(["Sam", "Alex"])).toBe("Sam en Alex typen…");
    expect(typingLabel(["Sam", "Alex", "Noor"])).toBe("3 mensen typen…");
  });

  it("prefixes previews with Jij or the sender in the group", () => {
    const name = (id: string) => (id === "sam" ? "Sam" : "?");
    expect(previewLine({ user_id: ME, body: "top", attachment_type: null, attachment_name: null }, ME, name, true, null)).toBe("Jij: top");
    expect(previewLine({ user_id: "sam", body: "", attachment_type: "image", attachment_name: null }, ME, name, true, "Foto")).toBe("Sam: Foto");
    expect(previewLine({ user_id: "sam", body: "hoi", attachment_type: null, attachment_name: null }, ME, name, false, null)).toBe("hoi");
    expect(previewLine({ user_id: ME, body: "advies", attachment_type: null, attachment_name: null, is_coach: true }, ME, name, true, null)).toBe("Baddy: advies");
  });
});

describe("chat list time", () => {
  it("shows the clock today, Gisteren yesterday and a date before", async () => {
    const { listTime } = await import("@/lib/conversations");
    expect(listTime("2026-11-02T08:05:00Z", "2026-11-02", "Europe/Amsterdam")).toBe("09:05");
    expect(listTime("2026-11-01T20:00:00Z", "2026-11-02", "Europe/Amsterdam")).toBe("Gisteren");
    expect(listTime("2026-10-28T20:00:00Z", "2026-11-02", "Europe/Amsterdam")).toBe("28-10");
  });
});
