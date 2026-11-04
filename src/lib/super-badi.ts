/**
 * Super Badi: the most involved member of the squad, shown with a crown.
 * The longest current streak wins; on a tie the most week points, then the
 * most check-in days in total. Members still level after that share the
 * crown. Nobody gets it while nobody has a streak.
 */
export interface SuperBadiInput {
  id: string;
  streak: number;
  weekPoints: number;
  totalDays: number;
}

export const SUPER_BADI_RULE = "Langste reeks. Bij gelijkstand de meeste weekpunten, daarna de meeste ingecheckte dagen.";

export function superBadi(members: SuperBadiInput[]): Set<string> {
  const ranked = [...members].sort((a, b) => b.streak - a.streak || b.weekPoints - a.weekPoints || b.totalDays - a.totalDays);
  const top = ranked[0];
  if (!top || top.streak < 1) return new Set();
  return new Set(ranked.filter((m) => m.streak === top.streak && m.weekPoints === top.weekPoints && m.totalDays === top.totalDays).map((m) => m.id));
}
