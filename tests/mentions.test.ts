import { describe, expect, it } from "vitest";
import { applyMention, findMentions, mentionLabels, mentionQuery, mentionSuggestions, splitMentions } from "@/lib/mentions";

const members = mentionLabels([
  { id: "a", display_name: "Sam de Vries" },
  { id: "b", display_name: "Noor Bakker" },
  { id: "c", display_name: "Sam Jansen" },
  { id: "d", display_name: "Alex" },
]);

describe("mentionLabels", () => {
  it("uses first names, and full names when first names collide", () => {
    expect(members.map((m) => m.label)).toEqual(["Sam de Vries", "Noor", "Sam Jansen", "Alex"]);
  });
});

describe("findMentions", () => {
  it("finds tagged members once each, case-insensitively, at word boundaries", () => {
    expect(findMentions("Hoi @Noor en @noor, kom je ook @Alex?", members)).toEqual(["b", "d"]);
    expect(findMentions("mail@Noor.nl is geen tag", members)).toEqual([]);
    expect(findMentions("@Alexander is iemand anders", members)).toEqual([]);
    expect(findMentions("@Sam de Vries loopt mee", members)).toEqual(["a"]);
  });
});

describe("splitMentions", () => {
  it("splits text into plain and mention tokens", () => {
    const tokens = splitMentions("Hoi @Noor, lekker!", members);
    expect(tokens).toEqual([{ text: "Hoi " }, { text: "@Noor", member: { id: "b", label: "Noor" } }, { text: ", lekker!" }]);
    expect(splitMentions("geen tags", members)).toEqual([{ text: "geen tags" }]);
  });
});

describe("composer helpers", () => {
  it("detects the @query under the caret", () => {
    expect(mentionQuery("Hoi @No", 7)).toEqual({ start: 4, query: "No" });
    expect(mentionQuery("Hoi @Noor hoe", 13)).toBeNull();
    expect(mentionQuery("mail@x", 6)).toBeNull();
    expect(mentionQuery("@", 1)).toEqual({ start: 0, query: "" });
  });

  it("suggests matching members without yourself and inserts the label", () => {
    expect(mentionSuggestions(members, "sa", "c").map((m) => m.id)).toEqual(["a"]);
    expect(mentionSuggestions(members, "", "a").map((m) => m.id)).toEqual(["b", "c", "d"]);
    expect(applyMention("Hoi @No", 7, 4, "Noor")).toEqual({ text: "Hoi @Noor ", caret: 10 });
  });
});
