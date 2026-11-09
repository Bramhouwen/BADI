/**
 * Super Badi: the member who did best in the week that just ended, shown with
 * a gold crown all of this week. Most week points (including bonus) win; on a
 * tie the most steps, then the most check-in days. Members still level share
 * it. Nobody gets it in a week without points.
 */
/** Gold of the Super Badi badge: light, mid and deep, like polished metal. */
export const GOLD = { light: "#f9e29a", mid: "#d9a63c", deep: "#8f6418" };

export interface WeekResult {
  id: string;
  /** Week points plus bonus. */
  points: number;
  steps: number;
  /** Days with a check-in that week. */
  days: number;
}

function compare(a: WeekResult, b: WeekResult): number {
  return b.points - a.points || b.steps - a.steps || b.days - a.days;
}

export function weekWinners(results: readonly WeekResult[]): string[] {
  const ranked = [...results].sort(compare);
  const top = ranked[0];
  if (!top || top.points < 1) return [];
  return ranked.filter((r) => compare(r, top) === 0).map((r) => r.id);
}

/** "Sam", "Sam en Noor", "Sam, Noor en Alex". */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} en ${names[names.length - 1]}`;
}

/** Baddy's message in the squad chat. */
export function superBadiMessage(names: readonly string[], points: number): string {
  const who = joinNames(names);
  return names.length > 1
    ? `🏆 Gefeliciteerd ${who}, jullie waren samen de Super Badi van vorige week met ${points} punten! Houden jullie de kroon vast, of geven jullie de troon deze week aan iemand anders?`
    : `🏆 Gefeliciteerd ${who}, jij was de Super Badi van vorige week met ${points} punten! Hou je de kroon vast, of geef je de troon deze week aan iemand anders?`;
}
