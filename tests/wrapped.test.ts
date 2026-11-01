import { describe, expect, it } from "vitest";
import { computeWrapped } from "@/lib/wrapped";

const members = [
  { id: "a", display_name: "Alex", avatar_path: null },
  { id: "b", display_name: "Sam", avatar_path: null },
  { id: "c", display_name: "Max", avatar_path: null },
  { id: "d", display_name: "Noor", avatar_path: null },
];

describe("wrapped calculations", () => {
  const result = computeWrapped({
    members,
    checkins: [
      { user_id: "a", checkin_date: "2026-11-01", activities: ["moved", "strength"] },
      { user_id: "a", checkin_date: "2026-11-02", activities: ["strength"] },
      { user_id: "a", checkin_date: "2026-11-03", activities: ["strength", "nutrition"] },
      { user_id: "b", checkin_date: "2026-11-01", activities: ["moved"] },
      { user_id: "c", checkin_date: "2026-11-01", activities: ["recovery"] },
      { user_id: "d", checkin_date: "2026-11-01", activities: ["hydration"] },
      { user_id: "d", checkin_date: "2026-11-05", activities: ["hydration"] },
      { user_id: "b", checkin_date: "2026-10-31", activities: ["moved"] }, // before the challenge: ignored
    ],
    posts: [
      { id: "p1", user_id: "a", image_path: "x/a/1.jpg", created_at: "2026-11-02T10:00:00Z", caption: null },
      { id: "p2", user_id: "b", image_path: "x/b/2.jpg", created_at: "2026-11-03T10:00:00Z", caption: "hi" },
    ],
    recipes: [{ user_id: "b" }, { user_id: "b" }],
    compliments: [
      { sender_id: "a", receiver_id: "b" },
      { sender_id: "c", receiver_id: "b" },
      { sender_id: "b", receiver_id: "a" },
    ],
    challenge: { start_date: "2026-11-01", end_date: "2026-12-31" },
    today: "2027-01-01",
  });

  it("sums group statistics without ranking anyone", () => {
    expect(result.group.totalCheckinDays).toBe(7);
    expect(result.group.totalPhotos).toBe(2);
    expect(result.group.totalRecipes).toBe(2);
    expect(result.group.totalCompliments).toBe(3);
    expect(result.group.longestStreakInGroup).toBe(3);
    expect(result.group.activeChallengeDays).toBe(4); // 1, 2, 3, 5 Nov
    expect(result.group.fullSquadDays).toBe(1); // 1 Nov
    expect(result.group.challengeLength).toBe(61);
  });

  it("keeps members in the given order (no podium)", () => {
    expect(result.personal.map((p) => p.member.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("builds personal highlights", () => {
    const alex = result.personal[0];
    expect(alex.totalDays).toBe(3);
    expect(alex.longestStreak).toBe(3);
    expect(alex.topActivity?.key).toBe("strength");
    expect(alex.topActivity?.count).toBe(3);
    expect(alex.photosShared).toBe(1);
    expect(alex.complimentsReceived).toBe(1);
    expect(alex.complimentsSent).toBe(1);

    const sam = result.personal[1];
    expect(sam.totalDays).toBe(1);
    expect(sam.recipesShared).toBe(2);
    expect(sam.complimentsReceived).toBe(2);
  });

  it("orders memories newest first", () => {
    expect(result.memories.map((m) => m.id)).toEqual(["p2", "p1"]);
  });
});
