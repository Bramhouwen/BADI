/**
 * The back garden of the BADI house: the Weekrad with its four squares and a
 * fire pit with two benches. The picture is an edit of an empty room
 * (docs/wereld/bron/achtertuin.png); every point here was measured on it at
 * 2000 x 1493. The house itself is the dollhouse (poppenhuis.ts).
 */
import type { SceneDef } from "../engine/scene";

/** The painted wheel in the back garden: its centre and outer radius, and its place in the drawing order (the deck's front edge). */
export const WHEEL_FACE = { x: 998, y: 487, r: 153, depth: 740 };

/** The four squares in front of the wheel (vak-1 to vak-4, left to right): where you stand, and the stone you tap. */
const SQUARES: { at: [number, number]; tap: [number, number][] }[] = [
  { at: [801, 770], tap: [[748, 740], [855, 740], [858, 800], [745, 800]] },
  { at: [935, 770], tap: [[886, 740], [985, 740], [987, 800], [884, 800]] },
  { at: [1073, 770], tap: [[1025, 740], [1122, 740], [1124, 800], [1023, 800]] },
  { at: [1209, 770], tap: [[1156, 740], [1262, 740], [1265, 800], [1153, 800]] },
];

export const ACHTERTUIN: SceneDef = {
  id: "achtertuin",
  name: "Achtertuin",
  background: "/wereld/scenes/achtertuin.webp",
  width: 2000,
  height: 1493,
  grid: { kind: "iso", floor: { top: [1000, 600], right: [1993, 986], bottom: [1000, 1486], left: [11, 971] }, tiles: 12 },
  // The lawn: along the house, the flower borders and the deck with the wheel.
  walkable: [[70, 975], [250, 905], [371, 875], [736, 750], [1279, 750], [1940, 958], [1000, 1455]],
  blockers: [
    // flower pot by the back door
    [[270, 890], [370, 880], [375, 925], [280, 935]],
    // left bench
    [[920, 1170], [930, 1205], [1025, 1235], [1250, 1100], [1240, 1060], [1130, 1060]],
    // right bench
    [[1445, 1045], [1680, 1110], [1780, 1060], [1770, 1000], [1560, 950], [1450, 990]],
    // fire pit
    [[1240, 1120], [1300, 1080], [1370, 1070], [1450, 1080], [1505, 1120], [1500, 1190], [1440, 1232], [1370, 1240], [1300, 1232], [1245, 1190]],
  ],
  occluders: [
    {
      id: "bank-links",
      outline: [[910, 1000], [940, 980], [1020, 960], [1140, 920], [1155, 930], [1165, 980], [1250, 990], [1250, 1015], [1235, 1030], [1235, 1100], [1220, 1110], [1110, 1120], [1065, 1130], [1040, 1220], [1020, 1232], [930, 1200], [920, 1180], [915, 1050]],
      front: [[925, 1205], [1025, 1234], [1232, 1106], [1252, 1096]],
    },
    {
      id: "bank-rechts",
      outline: [[1430, 920], [1440, 910], [1530, 890], [1540, 840], [1570, 830], [1680, 855], [1780, 890], [1805, 910], [1810, 950], [1785, 1000], [1770, 1060], [1750, 1080], [1710, 1110], [1680, 1100], [1675, 1050], [1600, 1060], [1530, 1070], [1480, 1050], [1455, 1030], [1440, 940]],
      front: [[1448, 1046], [1680, 1108], [1776, 1060]],
    },
    {
      id: "vuurkorf",
      outline: [[1235, 1090], [1250, 1065], [1300, 1045], [1350, 1000], [1380, 970], [1400, 1010], [1440, 1045], [1490, 1065], [1510, 1095], [1510, 1180], [1490, 1210], [1440, 1230], [1370, 1240], [1300, 1235], [1250, 1215], [1235, 1185]],
      front: [[1235, 1185], [1300, 1236], [1370, 1242], [1440, 1231], [1510, 1180]],
    },
  ],
  seats: [
    { id: "bank-links-1", hip: [1030, 1090], facing: "right", approach: [1160, 1200] },
    { id: "bank-links-2", hip: [1150, 1050], facing: "right", approach: [1160, 1200] },
    { id: "bank-rechts-1", hip: [1560, 980], facing: "left", approach: [1560, 1130] },
    { id: "bank-rechts-2", hip: [1660, 1010], facing: "left", approach: [1560, 1130] },
  ],
  doors: [{ id: "achterdeur", label: "Naar binnen", tap: [[50, 505], [240, 445], [245, 880], [55, 960]], approach: [210, 1000], to: "huis", arrive: "achterdeur" }],
  // Everyone in a square, facing the wheel: then the Weekrad opens (see wheel-ring.ts).
  spots: SQUARES.map((q, i) => ({ id: `vak-${i + 1}`, label: `Vakje ${i + 1}`, tap: q.tap, approach: q.at, at: q.at, facing: i < 2 ? ("right" as const) : ("left" as const), pose: "staan" })),
  spawn: [300, 1010],
  characterHeight: 340,
  seatStatus: "chillen",
};
