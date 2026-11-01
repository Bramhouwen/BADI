import { describe, expect, it } from "vitest";
import { isOwnedAvatarPath, isOwnedMediaPath } from "@/lib/media-paths";
import { friendlyError } from "@/lib/errors";
import { rotateMembers } from "@/lib/data-pure";

describe("photo upload authorization", () => {
  const challenge = "11111111-1111-1111-1111-111111111111";
  const me = "22222222-2222-2222-2222-222222222222";
  const other = "33333333-3333-3333-3333-333333333333";

  it("accepts a path inside the member's own folder", () => {
    expect(isOwnedMediaPath(`${challenge}/${me}/abc.jpg`, challenge, me)).toBe(true);
  });

  it("rejects paths of other members, other challenges or traversal", () => {
    expect(isOwnedMediaPath(`${challenge}/${other}/abc.jpg`, challenge, me)).toBe(false);
    expect(isOwnedMediaPath(`${other}/${me}/abc.jpg`, challenge, me)).toBe(false);
    expect(isOwnedMediaPath(`${challenge}/${me}/../${other}/abc.jpg`, challenge, me)).toBe(false);
    expect(isOwnedMediaPath(`${challenge}/${me}/`, challenge, me)).toBe(false);
    expect(isOwnedMediaPath(`${challenge}/${me}/a b.jpg`, challenge, me)).toBe(false);
  });

  it("validates avatar paths", () => {
    expect(isOwnedAvatarPath(`${me}/x.jpg`, me)).toBe(true);
    expect(isOwnedAvatarPath(`${other}/x.jpg`, me)).toBe(false);
  });
});

describe("private group errors", () => {
  it("maps database errors to friendly Dutch copy", () => {
    expect(friendlyError(new Error("MEMBER_LIMIT_REACHED"))).toMatch(/vier vrienden/);
    expect(friendlyError({ message: "new row violates row-level security policy" })).toMatch(/geen toegang/);
    expect(friendlyError("CHECKIN_OUTSIDE_WINDOW")).toMatch(/vandaag of gisteren/);
    expect(friendlyError("COMPLIMENT_TOO_FAST")).toMatch(/Rustig aan/);
  });
});

describe("squad ordering", () => {
  it("rotates members by day without ranking", () => {
    const m = ["a", "b", "c", "d"];
    expect(rotateMembers(m, 1)).toEqual(["b", "c", "d", "a"]);
    expect(rotateMembers(m, 4)).toEqual(["a", "b", "c", "d"]);
    expect(rotateMembers([], 3)).toEqual([]);
  });
});
