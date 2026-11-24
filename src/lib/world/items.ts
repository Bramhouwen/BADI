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
  category: "zitten" | "slapen" | "kasten" | "planten" | "sport" | "vloer" | "licht";
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
];

export const ITEM_BY_ID = new Map(ITEMS.map((i) => [i.id, i]));

export const CATEGORY_NAMES: Record<ItemDef["category"], string> = {
  zitten: "Zitten",
  slapen: "Slapen",
  kasten: "Kasten en tafels",
  planten: "Planten",
  sport: "Sport",
  vloer: "Kleden",
  licht: "Licht",
};

export function itemImage(id: string): string {
  return `/wereld/meubels/${id}.webp`;
}
