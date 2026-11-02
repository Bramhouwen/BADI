import { describe, expect, it } from "vitest";
import { attachmentHref, attachmentLabel, dayLabel, groupMessages, unreadCount } from "@/lib/chat";

const tz = "Europe/Amsterdam";
const today = "2026-11-12";
const msgs = [
  { id: "1", user_id: "a", body: "Hoi", created_at: "2026-11-11T20:00:00Z" },
  { id: "2", user_id: "a", body: "Wie gaat er morgen lopen?", created_at: "2026-11-11T20:02:00Z" },
  { id: "3", user_id: "b", body: "Ik om 7:00", created_at: "2026-11-11T20:10:00Z" },
  { id: "4", user_id: "a", body: "Top", created_at: "2026-11-11T20:30:00Z" },
  { id: "5", user_id: "b", body: "Klaar!", created_at: "2026-11-12T06:50:00Z" },
];

describe("groupMessages", () => {
  it("groups by local day and by sender runs within five minutes", () => {
    const days = groupMessages(msgs, today, tz);
    expect(days.map((d) => d.label)).toEqual(["Gisteren", "Vandaag"]);
    expect(days[0].runs.map((r) => r.messages.map((m) => m.id))).toEqual([["1", "2"], ["3"], ["4"]]);
    expect(days[1].runs[0].messages[0].id).toBe("5");
  });

  it("sorts unsorted input chronologically", () => {
    const days = groupMessages([...msgs].reverse(), today, tz);
    expect(days[0].runs[0].messages[0].id).toBe("1");
  });

  it("uses the local date, not UTC, at midnight", () => {
    const days = groupMessages([{ id: "x", user_id: "a", body: "Laat", created_at: "2026-11-11T23:30:00Z" }], today, tz);
    expect(days[0].date).toBe("2026-11-12"); // 00:30 in Amsterdam
    expect(days[0].label).toBe("Vandaag");
  });
});

describe("dayLabel", () => {
  it("names today, yesterday and other days", () => {
    expect(dayLabel("2026-11-12", today)).toBe("Vandaag");
    expect(dayLabel("2026-11-11", today)).toBe("Gisteren");
    expect(dayLabel("2026-11-01", today)).toMatch(/1 november/);
  });
});

describe("unreadCount", () => {
  it("counts only other people's messages after the last read moment", () => {
    expect(unreadCount(msgs, "2026-11-11T20:05:00Z", "a")).toBe(2);
    expect(unreadCount(msgs, null, "a")).toBe(2);
    expect(unreadCount(msgs, "2026-11-12T07:00:00Z", "a")).toBe(0);
    expect(unreadCount(msgs, null, "b")).toBe(3);
  });
});

describe("attachments", () => {
  it("labels and links each attachment type", () => {
    expect(attachmentLabel({ attachment_type: "image", attachment_name: null })).toBe("Foto");
    expect(attachmentLabel({ attachment_type: "file", attachment_name: "schema.pdf" })).toBe("Bestand: schema.pdf");
    expect(attachmentLabel({ attachment_type: "recipe", attachment_name: "Linzen dahl" })).toBe("Recept: Linzen dahl");
    expect(attachmentLabel({ attachment_type: null, attachment_name: null })).toBeNull();
    expect(attachmentHref({ attachment_type: "recipe", ref_id: "r1" })).toBe("/kitchen/r1");
    expect(attachmentHref({ attachment_type: "post", ref_id: "p1" })).toBe("/wall/p1");
    expect(attachmentHref({ attachment_type: "image", ref_id: null })).toBeNull();
  });
});
