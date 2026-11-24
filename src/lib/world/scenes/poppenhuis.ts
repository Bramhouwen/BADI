/**
 * The BADI house as a dollhouse: the front open, both floors in one picture
 * (public/wereld/scenes/huis.webp, source docs/wereld/bron/huis.png). Ground
 * floor: the hall with the front door and the stairs, through an open doorway
 * the living room with the kitchen corner and a glass back door to the back
 * garden. Upstairs: the landing behind the banister and the four bedrooms
 * (green Bram, peach Anne, blue Daphne, lilac Irene). You walk up the stairs
 * and in and out of the rooms without a door in between; tap a bedroom to go
 * into that room itself (to furnish it, change clothes, its spaces). The
 * upper floor is drawn smaller, so characters are too (heightByY). Measured
 * on the picture at 2000 x 1507.
 */
import type { SceneDef } from "../engine/scene";
import { roomId } from "./kamers";

/** The bedrooms upstairs, left to right: who lives there, where to tap, where to stand in front of it. */
export const BEDROOMS: { character: string; name: string; tap: [number, number][]; approach: [number, number] }[] = [
  { character: "bram", name: "Bram", tap: [[64, 300], [600, 160], [600, 570], [64, 570]], approach: [520, 700] },
  { character: "anne", name: "Anne", tap: [[629, 160], [989, 30], [989, 570], [629, 570]], approach: [810, 700] },
  { character: "daphne", name: "Daphne", tap: [[1011, 30], [1407, 160], [1407, 570], [1011, 570]], approach: [1210, 700] },
  { character: "irene", name: "Irene", tap: [[1429, 160], [1979, 330], [1979, 570], [1429, 570]], approach: [1600, 700] },
];

export const HUIS: SceneDef = {
  id: "huis",
  name: "Huis",
  background: "/wereld/scenes/huis.webp",
  width: 2000,
  height: 1507,
  grid: { kind: "screen", cell: 25 },
  walkable: [
    // ground floor: hall, the doorway and the living room
    [[71, 1330], [229, 1250], [471, 1229], [564, 1229], [571, 1243], [857, 1193], [943, 1129], [1386, 1100], [1486, 1064], [1686, 1086], [1972, 1257], [1972, 1268], [1000, 1405], [71, 1342]],
    // the stairs, from the hall up through the floor to the landing
    [[343, 1283], [443, 1257], [350, 771], [236, 771]],
    [[200, 730], [336, 730], [336, 790], [200, 790]],
    // upstairs: the strip in front of the beds and the landing behind the banister
    [[64, 586], [1786, 586], [1786, 636], [1693, 636], [1686, 736], [186, 736], [186, 636], [64, 636]],
  ],
  blockers: [
    // kitchen counter and stove
    [[564, 1193], [871, 1164], [874, 1240], [569, 1246]],
    // coffee table
    [[1064, 1129], [1336, 1129], [1336, 1186], [1064, 1186]],
    // dining table and chairs: where their legs stand
    [[1214, 1371], [1243, 1257], [1543, 1257], [1593, 1286], [1586, 1371], [1429, 1421], [1229, 1379]],
    // armchair and side table
    [[1493, 1120], [1686, 1120], [1686, 1186], [1493, 1186]],
    // plants: in the hall, in front, by the back door
    [[214, 1214], [329, 1214], [329, 1264], [214, 1264]],
    [[629, 1350], [743, 1350], [743, 1414], [629, 1414]],
    [[1807, 1221], [1900, 1221], [1907, 1279], [1814, 1279]],
    // the posts of the doorway between hall and living room
    [[394, 1293], [436, 1293], [436, 1360], [394, 1360]],
    [[526, 1207], [557, 1207], [557, 1243], [526, 1243]],
    // upstairs: the walls between the bedrooms and two plants
    [[603, 564], [629, 564], [629, 640], [603, 640]],
    [[989, 564], [1011, 564], [1011, 640], [989, 640]],
    [[1407, 564], [1429, 564], [1429, 640], [1407, 640]],
    [[57, 600], [143, 600], [143, 650], [57, 650]],
    [[371, 686], [471, 686], [471, 729], [371, 729]],
  ],
  occluders: [
    // the banister around the stairwell upstairs, in front of whoever walks behind it
    { id: "leuning", outline: [[186, 600], [536, 607], [536, 743], [186, 743]], front: [[186, 743], [536, 743]] },
    {
      id: "eettafel",
      outline: [[1214, 1214], [1257, 1171], [1543, 1164], [1600, 1200], [1593, 1371], [1429, 1421], [1229, 1371]],
      front: [[1229, 1371], [1429, 1421], [1593, 1371]],
    },
  ],
  seats: [
    { id: "bank-1", hip: [1057, 1036], facing: "right", approach: [1030, 1125] },
    { id: "bank-2", hip: [1171, 1036], facing: "right", approach: [1030, 1125] },
    { id: "bank-3", hip: [1286, 1036], facing: "left", approach: [1360, 1125] },
    { id: "fauteuil", hip: [1571, 1057], facing: "left", approach: [1440, 1150] },
  ],
  doors: [
    { id: "voordeur", label: "Naar buiten", tap: [[64, 879], [186, 879], [186, 1300], [64, 1336]], approach: [200, 1300], to: "buiten", arrive: "huis" },
    { id: "achterdeur", label: "Naar de achtertuin", tap: [[1736, 807], [1914, 807], [1914, 1215], [1736, 1164]], approach: [1760, 1180], to: "achtertuin", arrive: "achterdeur" },
    ...BEDROOMS.map((b) => ({ id: `deur-${b.character}`, label: `Kamer van ${b.name}`, tap: b.tap, approach: b.approach, to: roomId(b.character), arrive: "deur" })),
  ],
  spots: [{ id: "fornuis", label: "Koken", tap: [[636, 1021], [771, 1021], [771, 1200], [636, 1200]], approach: [707, 1270], at: [707, 1270], facing: "right", pose: "staan", status: "koken" }],
  spawn: [1000, 1300],
  characterHeight: 300,
  // Upstairs is drawn smaller; on the stairs it changes evenly.
  heightByY: [
    [740, 170],
    [1040, 300],
  ],
  camera: { start: "close" },
  seatStatus: "chillen",
};
