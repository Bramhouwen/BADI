/**
 * The shop of World of Badi: furniture for your own room, bought with coins.
 * Pictures in public/wereld/meubels/<id>.webp (made with an image model in
 * the style of the living room; sources in docs/wereld/bron/kamers). The
 * prices are also in the database (migration 0032), which checks them when
 * you buy; keep both the same.
 */

export interface ItemDef {
  id: string;
  name: string;
  price: number;
  /** The last four are for the extra spaces; the shop opens on the one you are in. */
  category: "zitten" | "slapen" | "kasten" | "planten" | "sport" | "vloer" | "licht" | "badkamer" | "tuin" | "zolder" | "gym";
  /** Drawn size in room pixels (a standing character is 340 high). */
  w: number;
  h: number;
  /** Tiles it takes on the floor: along the right wall (a) and along the left wall (b). */
  foot: [number, number];
  /** Lies flat on the floor (a rug, a mat): drawn under everything, you walk over it. */
  flat?: boolean;
  /** You can sit on it: the hip point as a share of the picture from its bottom centre. */
  seat?: { dx: number; dy: number };
}

export const ITEMS: ItemDef[] = [
  { id: "bank", name: "Bankje", price: 80, category: "zitten", w: 430, h: 281, foot: [4, 2], seat: { dx: 0, dy: 0.36 } },
  { id: "fauteuil", name: "Fauteuil", price: 55, category: "zitten", w: 260, h: 291, foot: [2, 2], seat: { dx: 0, dy: 0.32 } },
  { id: "zitzak", name: "Zitzak", price: 35, category: "zitten", w: 230, h: 212, foot: [2, 2], seat: { dx: 0, dy: 0.3 } },
  { id: "bureaustoel", name: "Bureaustoel", price: 30, category: "zitten", w: 170, h: 276, foot: [1, 1], seat: { dx: 0, dy: 0.4 } },
  { id: "bed", name: "Bed", price: 100, category: "slapen", w: 470, h: 479, foot: [3, 4] },
  { id: "bureau", name: "Bureau", price: 60, category: "kasten", w: 380, h: 369, foot: [3, 2] },
  { id: "boekenkast", name: "Boekenkast", price: 50, category: "kasten", w: 230, h: 437, foot: [2, 1] },
  { id: "kledingkast", name: "Kledingkast", price: 70, category: "kasten", w: 240, h: 458, foot: [2, 1] },
  { id: "tv-meubel", name: "Tv-meubel", price: 70, category: "kasten", w: 360, h: 359, foot: [3, 1] },
  { id: "trofeekast", name: "Trofeekast", price: 90, category: "kasten", w: 330, h: 294, foot: [3, 1] },
  { id: "bijzettafel", name: "Bijzettafel", price: 20, category: "kasten", w: 150, h: 223, foot: [1, 1] },
  { id: "plant", name: "Grote plant", price: 30, category: "planten", w: 230, h: 318, foot: [1, 1] },
  { id: "plantenrek", name: "Plantenrek", price: 35, category: "planten", w: 190, h: 373, foot: [1, 1] },
  { id: "cactus", name: "Cactus", price: 15, category: "planten", w: 110, h: 180, foot: [1, 1] },
  { id: "halterrek", name: "Halterrek", price: 80, category: "sport", w: 260, h: 283, foot: [2, 1] },
  { id: "hometrainer", name: "Hometrainer", price: 120, category: "sport", w: 230, h: 298, foot: [2, 1] },
  { id: "yogamat", name: "Yogamat", price: 25, category: "sport", w: 380, h: 235, foot: [3, 2], flat: true },
  { id: "kleed-rond", name: "Rond kleed", price: 40, category: "vloer", w: 520, h: 241, foot: [4, 4], flat: true },
  { id: "kleed-rechthoek", name: "Streepjeskleed", price: 35, category: "vloer", w: 500, h: 297, foot: [4, 3], flat: true },
  { id: "vloerlamp", name: "Vloerlamp", price: 30, category: "licht", w: 120, h: 351, foot: [1, 1] },
  // For the extra spaces (migration 0034); they may stand anywhere.
  { id: "bad", name: "Bad", price: 90, category: "badkamer", w: 322, h: 280, foot: [3, 2] },
  { id: "douche", name: "Douche", price: 80, category: "badkamer", w: 249, h: 430, foot: [2, 2] },
  { id: "wastafel", name: "Wastafel met spiegel", price: 50, category: "badkamer", w: 196, h: 400, foot: [2, 1] },
  { id: "wasmand", name: "Wasmand", price: 20, category: "badkamer", w: 104, h: 150, foot: [1, 1] },
  { id: "handdoekenrek", name: "Handdoekenrek", price: 25, category: "badkamer", w: 156, h: 260, foot: [1, 1] },
  { id: "badmat", name: "Badmat", price: 15, category: "badkamer", w: 235, h: 150, foot: [2, 1], flat: true },
  { id: "loungebank", name: "Loungebank", price: 90, category: "tuin", w: 334, h: 290, foot: [3, 2], seat: { dx: 0, dy: 0.36 } },
  { id: "tuinset", name: "Tuintafel met stoelen", price: 70, category: "tuin", w: 446, h: 260, foot: [3, 3] },
  { id: "barbecue", name: "Barbecue", price: 60, category: "tuin", w: 175, h: 250, foot: [1, 1] },
  { id: "parasol", name: "Parasol", price: 40, category: "tuin", w: 351, h: 480, foot: [2, 2] },
  { id: "bloembak", name: "Bloembak", price: 25, category: "tuin", w: 219, h: 170, foot: [2, 1] },
  { id: "tuinlantaarn", name: "Tuinlantaarn", price: 20, category: "tuin", w: 101, h: 380, foot: [1, 1] },
  { id: "arcadekast", name: "Arcadekast", price: 110, category: "zolder", w: 220, h: 420, foot: [2, 1] },
  { id: "platenspeler", name: "Platenspeler met boxen", price: 45, category: "zolder", w: 221, h: 260, foot: [2, 1] },
  { id: "kist", name: "Oude kist", price: 30, category: "zolder", w: 162, h: 170, foot: [2, 1] },
  { id: "zitkussens", name: "Zitkussens", price: 25, category: "zolder", w: 165, h: 150, foot: [1, 1], seat: { dx: 0, dy: 0.7 } },
  { id: "boekenladder", name: "Ladder met boeken", price: 35, category: "zolder", w: 203, h: 400, foot: [2, 1] },
  { id: "lichtslinger", name: "Lichtslingerpaal", price: 30, category: "zolder", w: 116, h: 380, foot: [1, 1] },
  { id: "loopband", name: "Loopband", price: 130, category: "gym", w: 295, h: 330, foot: [3, 1] },
  { id: "squatrack", name: "Squat rack", price: 120, category: "gym", w: 337, h: 440, foot: [2, 2] },
  { id: "bokszak", name: "Bokszak", price: 60, category: "gym", w: 215, h: 440, foot: [2, 1] },
  { id: "sportbank", name: "Sportbank", price: 50, category: "gym", w: 182, h: 220, foot: [2, 1], seat: { dx: 0, dy: 0.4 } },
  { id: "kettlebells", name: "Kettlebells", price: 30, category: "gym", w: 168, h: 150, foot: [2, 1] },
  { id: "springtouw", name: "Springtouwrek", price: 20, category: "gym", w: 160, h: 300, foot: [1, 1] },
];

/**
 * The clothing rack every room has from the start: not for sale, not stored
 * in the database. It stands against the back wall at RACK_AT, or on the
 * first free place when the owner put something there. Tap it in your own
 * room to change clothes.
 */
export const RACK: ItemDef = { id: "kledingrek", name: "Kledingrek", price: 0, category: "kasten", w: 246, h: 330, foot: [1, 2] };
export const RACK_AT = { u: 0, v: 3 };

export const ITEM_BY_ID = new Map([...ITEMS, RACK].map((i) => [i.id, i]));

export const CATEGORY_NAMES: Record<ItemDef["category"], string> = {
  zitten: "Zitten",
  slapen: "Slapen",
  kasten: "Kasten en tafels",
  planten: "Planten",
  sport: "Sport",
  vloer: "Kleden",
  licht: "Licht",
  badkamer: "Badkamer",
  tuin: "Tuin",
  zolder: "Zolder",
  gym: "Gym",
};

export function itemImage(id: string): string {
  return `/wereld/meubels/${id}.webp`;
}
