/**
 * Outside: the village with the BADI house, Traffic Today, the gym and the
 * park. Measured on public/wereld/scenes/buiten.webp (2000 x 1131). Not drawn
 * on a clean diagonal, so the grid is square cells over the whole picture and
 * everything you cannot walk through is a blocker. Characters are drawn much
 * smaller here; the camera starts closer.
 */
import type { SceneDef } from "../engine/scene";
import { readSeats } from "../engine/seats";
import zitplekken from "./buiten.zitplekken.json";

/** A lamp post: thin, so you can walk behind it. */
const lamp = (id: string, x: number, top: number, base: number) => ({
  id,
  outline: [[x - 20, top], [x + 20, top], [x + 20, base], [x - 20, base]] as [number, number][],
  front: [[x - 20, base], [x + 20, base]] as [number, number][],
});

export const BUITEN: SceneDef = {
  id: "buiten",
  name: "Buiten",
  background: "/wereld/scenes/buiten.webp",
  width: 2000,
  height: 1131,
  grid: { kind: "screen", cell: 10 },
  walkable: [[8, 8], [1992, 8], [1992, 1105], [8, 1105]],
  blockers: [
    // the BADI house with its hedge, trees and front garden beds
    [[0, 0], [700, 0], [760, 180], [790, 300], [805, 380], [835, 440], [805, 455], [700, 395], [650, 400], [625, 412], [555, 412], [520, 430], [500, 525], [267, 472], [0, 442]],
    // Traffic Today with its flower beds
    [[1100, 0], [2000, 0], [2000, 505], [1600, 490], [1585, 420], [1470, 420], [1440, 425], [1300, 385], [1200, 335], [1175, 280], [1120, 120]],
    // the gym with its bushes
    [[1180, 830], [1190, 700], [1245, 640], [1300, 560], [1700, 540], [1900, 600], [2000, 640], [2000, 1000], [1890, 1010], [1670, 960], [1556, 925], [1430, 922], [1310, 935], [1195, 915]],
    // trees and bushes in the bottom right corner
    [[1722, 974], [2000, 960], [2000, 1131], [1700, 1131]],
    // pond
    [[105, 860], [180, 820], [300, 815], [420, 830], [480, 880], [500, 960], [470, 1030], [350, 1055], [200, 1050], [110, 1000]],
    // vegetable garden behind its fence, with the shed
    [[505, 690], [620, 600], [770, 600], [840, 700], [945, 800], [945, 840], [790, 905], [620, 925], [560, 900], [505, 760]],
    // hydrangeas bottom left and the bushes along the bottom
    [[0, 950], [200, 960], [215, 1131], [0, 1131]],
    [[200, 1063], [380, 1063], [380, 1131], [200, 1131]],
    // tree trunks
    [[845, 200], [885, 200], [885, 245], [845, 245]],
    [[20, 820], [100, 820], [100, 900], [20, 900]],
    [[420, 740], [480, 740], [480, 788], [420, 788]],
    [[860, 1040], [925, 1040], [925, 1090], [860, 1090]],
    // benches
    [[255, 740], [365, 740], [365, 785], [255, 785]],
    [[605, 1020], [740, 1020], [740, 1066], [605, 1066]],
    // lamp posts
    [[898, 420], [922, 420], [922, 438], [898, 438]],
    [[1135, 398], [1159, 398], [1159, 416], [1135, 416]],
    [[804, 676], [828, 676], [828, 692], [804, 692]],
    [[1218, 686], [1242, 686], [1242, 702], [1218, 702]],
  ],
  occluders: [
    {
      id: "treurwilg",
      outline: [[0, 530], [233, 530], [233, 760], [120, 830], [100, 897], [20, 897], [0, 860]],
      front: [[0, 897], [110, 897]],
    },
    {
      id: "boom-straat",
      outline: [[740, 0], [960, 0], [960, 150], [890, 200], [885, 245], [845, 245], [840, 200], [740, 150]],
      front: [[840, 247], [890, 247]],
    },
    {
      id: "boom-park",
      outline: [[305, 560], [380, 530], [589, 540], [589, 680], [490, 720], [482, 785], [418, 785], [410, 720], [305, 680]],
      front: [[410, 788], [490, 788]],
    },
    {
      id: "boom-rechts",
      outline: [[789, 840], [880, 813], [1000, 840], [1000, 990], [925, 1000], [925, 1088], [860, 1088], [860, 1000], [789, 980]],
      front: [[855, 1090], [930, 1090]],
    },
    {
      id: "bank-park",
      outline: [[255, 702], [361, 702], [361, 782], [255, 782]],
      front: [[255, 782], [361, 780]],
    },
    {
      id: "bank-tuin",
      outline: [[605, 969], [739, 969], [739, 1064], [605, 1064]],
      front: [[605, 1064], [739, 1062]],
    },
    lamp("lamp-huis", 910, 250, 433),
    lamp("lamp-tt", 1147, 228, 411),
    lamp("lamp-park", 816, 522, 686),
    lamp("lamp-sport", 1230, 520, 697),
  ],
  seats: readSeats(zitplekken),
  doors: [
    { id: "huis", label: "Naar binnen", tap: [[550, 267], [607, 262], [607, 402], [550, 405]], approach: [592, 440], to: "woonkamer", arrive: "voordeur" },
    { id: "kantoor", label: "Traffic Today", tap: [[1472, 305], [1580, 305], [1580, 420], [1472, 420]], approach: [1525, 450], to: "kantoor", arrive: "glazen-deur" },
    { id: "sportschool", label: "Sportschool", tap: [[1433, 813], [1544, 813], [1544, 920], [1433, 920]], approach: [1488, 950], to: "sportschool", arrive: "deur" },
  ],
  spots: [],
  spawn: [592, 470],
  characterHeight: 112,
  startZoom: 1.6,
};
