/**
 * Outfits in World of Badi: the clothes your character wears. Every outfit is
 * its own set of drawn frames, public/wereld/poppetjes/<naam>-<outfit> (made by
 * `npm run wereld:poppetjes`); the normal clothes are the character itself.
 * You change at the clothing rack in your own room. The gold tracksuit with
 * the crown is only for the Super Badi of this week, who wears it from Monday
 * on unless they take it off.
 */

export type OutfitId = "standaard" | "goud";

export interface OutfitDef {
  id: OutfitId;
  name: string;
  /** Only the Super Badi of this week may wear it. */
  superBadi?: boolean;
}

export const OUTFITS: OutfitDef[] = [
  { id: "standaard", name: "Gewone kleding" },
  { id: "goud", name: "Gouden sportpak met kroon", superBadi: true },
];

const IDS = new Set<string>(OUTFITS.map((o) => o.id));

/** Folder in public/wereld/poppetjes for a character in an outfit. */
export function spriteKey(character: string, outfit: OutfitId): string {
  return outfit === "standaard" ? character : `${character}-${outfit}`;
}

export function mayWear(outfit: OutfitId, isSuperBadi: boolean): boolean {
  return !OUTFITS.find((o) => o.id === outfit)?.superBadi || isSuperBadi;
}

/** What you wear when you did not choose this week: gold for the Super Badi. */
export function defaultOutfit(isSuperBadi: boolean): OutfitId {
  return isSuperBadi ? "goud" : "standaard";
}

/** Your choice at the rack, kept on this device for the week it was made in. */
export interface OutfitChoice {
  outfit: OutfitId;
  /** Monday of the week, YYYY-MM-DD. */
  week: string;
}

/** What you wear now: your choice of this week when you may still wear it, else the default. */
export function currentOutfit(choice: OutfitChoice | null, week: string, isSuperBadi: boolean): OutfitId {
  if (choice && choice.week === week && mayWear(choice.outfit, isSuperBadi)) return choice.outfit;
  return defaultOutfit(isSuperBadi);
}

export const outfitKey = (userId: string) => `wereld-outfit:${userId}`;

export function readOutfitChoice(userId: string): OutfitChoice | null {
  try {
    const v = JSON.parse(localStorage.getItem(outfitKey(userId)) ?? "null") as Record<string, unknown> | null;
    if (v && typeof v.outfit === "string" && IDS.has(v.outfit) && typeof v.week === "string") return { outfit: v.outfit as OutfitId, week: v.week };
  } catch {
    // no storage (private window): the default outfit
  }
  return null;
}

export function saveOutfitChoice(userId: string, choice: OutfitChoice) {
  try {
    localStorage.setItem(outfitKey(userId), JSON.stringify(choice));
  } catch {
    // no storage: the choice lasts until the page closes
  }
}
