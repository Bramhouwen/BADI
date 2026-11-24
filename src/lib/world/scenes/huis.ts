/**
 * The rest of the BADI house: the hall downstairs (front door, living room,
 * back garden and the stairs), the landing upstairs with the four bedroom
 * doors, and the back garden with the Weekrad and a fire pit. The pictures
 * are edits of the empty room (docs/wereld/bron/hal.png, overloop.png,
 * achtertuin.png); every point here was measured on them at 2000 x 1493.
 */
import type { SceneDef } from "../engine/scene";
import { roomId } from "./kamers";

/** Which bedroom door on the landing is whose: left wall front and back, right wall back and front. */
export const LANDING_DOORS: Record<string, { tap: [number, number][]; approach: [number, number] }> = {
  anne: { tap: [[65, 515], [265, 440], [265, 850], [70, 930]], approach: [235, 975] },
  bram: { tap: [[365, 385], [555, 310], [555, 735], [370, 805]], approach: [525, 870] },
  daphne: { tap: [[1443, 310], [1632, 380], [1632, 870], [1443, 800]], approach: [1470, 880] },
  irene: { tap: [[1733, 430], [1928, 500], [1928, 930], [1733, 868]], approach: [1770, 980] },
};

const NAMES: Record<string, string> = { anne: "Anne", bram: "Bram", daphne: "Daphne", irene: "Irene" };

export const HAL: SceneDef = {
  id: "hal",
  name: "Hal",
  background: "/wereld/scenes/hal.webp",
  width: 2000,
  height: 1493,
  grid: { kind: "iso", floor: { top: [1086, 629], right: [1993, 986], bottom: [1000, 1486], left: [21, 955] }, tiles: 12 },
  walkable: [[1086, 660], [1940, 990], [1000, 1455], [75, 958]],
  blockers: [
    // the stairs along the left wall, up to the back corner
    [[590, 770], [770, 815], [1090, 690], [1090, 625]],
    // shoe bench by the front door
    [[240, 890], [560, 792], [600, 840], [270, 945]],
    // side table with the lamp at the foot of the stairs
    [[520, 800], [650, 770], [660, 830], [540, 850]],
    // big plant by the living room door
    [[1340, 760], [1470, 740], [1490, 790], [1360, 810]],
  ],
  occluders: [],
  seats: [],
  doors: [
    { id: "voordeur", label: "Naar buiten", tap: [[55, 500], [205, 455], [218, 470], [218, 870], [80, 938], [55, 930]], approach: [255, 975], to: "buiten", arrive: "huis" },
    { id: "woonkamer", label: "Naar de woonkamer", tap: [[1130, 240], [1300, 300], [1300, 710], [1130, 646]], approach: [1200, 770], to: "woonkamer", arrive: "voordeur" },
    { id: "achterdeur", label: "Naar de achtertuin", tap: [[1636, 380], [1857, 450], [1857, 933], [1636, 847]], approach: [1720, 975], to: "achtertuin", arrive: "achterdeur" },
    { id: "trap", label: "Naar boven", tap: [[620, 560], [1000, 60], [1090, 180], [1090, 640], [760, 810], [620, 800]], approach: [740, 880], to: "overloop", arrive: "trap" },
  ],
  spots: [],
  spawn: [1000, 1050],
  characterHeight: 340,
};

export const OVERLOOP: SceneDef = {
  id: "overloop",
  name: "Overloop",
  background: "/wereld/scenes/overloop.webp",
  width: 2000,
  height: 1493,
  grid: { kind: "iso", floor: { top: [998, 600], right: [1988, 960], bottom: [998, 1485], left: [15, 960] }, tiles: 12 },
  walkable: [[998, 630], [1935, 962], [998, 1455], [62, 962]],
  blockers: [
    // the stairwell with its banisters
    [[660, 1340], [860, 1070], [1000, 1170], [1135, 1070], [1335, 1340], [998, 1485]],
    // plant on its stool in the back corner
    [[930, 640], [1070, 640], [1070, 700], [930, 700]],
  ],
  occluders: [],
  seats: [],
  doors: [
    { id: "trap", label: "Naar beneden", tap: [[700, 1300], [880, 1080], [1000, 1150], [1120, 1080], [1300, 1300], [1000, 1480]], approach: [998, 1090], to: "hal", arrive: "trap" },
    ...Object.entries(LANDING_DOORS).map(([c, d]) => ({ id: `deur-${c}`, label: `Kamer van ${NAMES[c]}`, tap: d.tap, approach: d.approach, to: roomId(c), arrive: "deur" })),
  ],
  spots: [],
  spawn: [998, 1050],
  characterHeight: 340,
};

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
  doors: [{ id: "achterdeur", label: "Naar binnen", tap: [[50, 505], [240, 445], [245, 880], [55, 960]], approach: [210, 1000], to: "hal", arrive: "achterdeur" }],
  spots: [
    {
      id: "weekrad",
      label: "Weekrad",
      tap: [[843, 350], [1150, 350], [1150, 710], [843, 710]],
      approach: [1000, 800],
      at: [1000, 800],
      facing: "right",
      pose: "staan",
      link: { label: "Draai het Weekrad", href: "/wheel" },
      walkFirst: true,
      doLabel: null,
    },
  ],
  spawn: [300, 1010],
  characterHeight: 340,
  seatStatus: "chillen",
};
