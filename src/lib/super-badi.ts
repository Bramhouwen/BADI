/**
 * Super Badi: the most involved member of the squad, shown with a gold crown.
 * The longest current streak wins. On a tie: the most week points, then the
 * most steps this week, then the most check-in days in total, then whoever
 * checked in first today. Members still level after all that share it.
 * Nobody gets it while nobody has a streak.
 */
/** Gold of the Super Badi badge: light, mid and deep, like polished metal. */
export const GOLD = { light: "#f9e29a", mid: "#d9a63c", deep: "#8f6418" };

export interface SuperBadiInput {
  id: string;
  streak: number;
  weekPoints: number;
  weekSteps: number;
  totalDays: number;
  /** When today's check-in was first saved (ISO), or null. Earlier wins. */
  checkedInAt: string | null;
}

function compare(a: SuperBadiInput, b: SuperBadiInput): number {
  // Not checked in today sorts last; Infinity minus Infinity would be NaN, so compare instead of subtract.
  const early = (x: SuperBadiInput) => (x.checkedInAt ? Date.parse(x.checkedInAt) : Number.POSITIVE_INFINITY);
  const ea = early(a);
  const eb = early(b);
  return b.streak - a.streak || b.weekPoints - a.weekPoints || b.weekSteps - a.weekSteps || b.totalDays - a.totalDays || (ea === eb ? 0 : ea < eb ? -1 : 1);
}

export function superBadi(members: SuperBadiInput[]): Set<string> {
  const ranked = [...members].sort(compare);
  const top = ranked[0];
  if (!top || top.streak < 1) return new Set();
  return new Set(ranked.filter((m) => compare(m, top) === 0).map((m) => m.id));
}
