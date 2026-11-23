import { describe, expect, it } from "vitest";
import { dmPeer, lockBalloonOver, totalUnread, withUnread, type WorldDm } from "@/lib/world/dm";

const ME = "me", ANNE = "anne", DAPHNE = "daphne";
const dm = (from: string, to: string, text = "hoi"): WorldDm => ({ id: `${from}-${to}-${text}`, from, to, text, at: "2026-11-23T20:00:00Z" });

describe("private messages in the world", () => {
  it("only counts private messages you are part of", () => {
    expect(dmPeer({ user_id: ANNE, recipient_id: ME }, ME)).toBe(ANNE);
    expect(dmPeer({ user_id: ME, recipient_id: ANNE }, ME)).toBe(ANNE);
    expect(dmPeer({ user_id: ANNE, recipient_id: null }, ME)).toBeNull();
    expect(dmPeer({ user_id: ANNE, recipient_id: DAPHNE }, ME)).toBeNull();
  });
  it("shows the lock balloon over the sender when both are in the room", () => {
    const here = new Set([ME, ANNE]);
    const inRoom = (id: string) => here.has(id);
    expect(lockBalloonOver(dm(ANNE, ME), ME, inRoom)).toBe(ANNE);
    expect(lockBalloonOver(dm(ME, ANNE), ME, inRoom)).toBe(ME);
  });
  it("shows no balloon when the other one is somewhere else, or for a conversation of others", () => {
    const inRoom = (id: string) => id === ME;
    expect(lockBalloonOver(dm(ME, DAPHNE), ME, inRoom)).toBeNull();
    expect(lockBalloonOver(dm(DAPHNE, ME), ME, inRoom)).toBeNull();
    expect(lockBalloonOver(dm(ANNE, DAPHNE), ME, () => true)).toBeNull();
  });
  it("counts unread messages per sender, not your own and not in the conversation you have open", () => {
    let u = withUnread({}, dm(ANNE, ME, "1"), ME, null);
    u = withUnread(u, dm(ANNE, ME, "2"), ME, null);
    u = withUnread(u, dm(ME, ANNE, "3"), ME, null);
    u = withUnread(u, dm(DAPHNE, ME, "4"), ME, DAPHNE);
    expect(u).toEqual({ [ANNE]: 2 });
    expect(totalUnread({ [ANNE]: 2, [DAPHNE]: 1 })).toBe(3);
  });
});
