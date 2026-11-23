/**
 * The gym. Measured on public/wereld/scenes/sportschool.webp (2000 x 1493).
 * Square cells inside the drawn floor. Run on a treadmill, jump squats on a
 * mat; sit on the weight bench (sportschool.zitplekken.json).
 */
import type { SceneDef } from "../engine/scene";
import { readSeats } from "../engine/seats";
import zitplekken from "./sportschool.zitplekken.json";

export const SPORTSCHOOL: SceneDef = {
  id: "sportschool",
  name: "Sportschool",
  background: "/wereld/scenes/sportschool.webp",
  width: 2000,
  height: 1493,
  grid: { kind: "screen", cell: 20 },
  walkable: [[70, 975], [300, 868], [1000, 588], [1940, 1005], [1000, 1455], [70, 985]],
  blockers: [
    // plant by the door
    [[60, 880], [190, 870], [190, 955], [60, 965]],
    // treadmills
    [[405, 790], [485, 695], [755, 805], [620, 885]],
    [[635, 715], [700, 615], [970, 730], [860, 800]],
    // plant in the corner, water cooler
    [[920, 555], [1015, 555], [1015, 650], [920, 650]],
    [[1080, 615], [1210, 615], [1210, 675], [1080, 675]],
    // weight bench and rack
    [[1165, 805], [1240, 735], [1455, 735], [1545, 785], [1545, 845], [1305, 890], [1165, 870]],
    // dumbbell rack
    [[1560, 875], [1615, 795], [1910, 895], [1910, 995], [1785, 1000]],
  ],
  occluders: [
    {
      id: "monstera",
      outline: [[28, 560], [100, 543], [211, 600], [211, 700], [178, 780], [178, 943], [67, 943], [67, 780], [28, 700]],
      front: [[67, 945], [178, 943]],
    },
    {
      id: "loopband-1",
      outline: [[405, 790], [425, 610], [430, 545], [470, 535], [600, 555], [655, 590], [655, 640], [560, 690], [750, 800], [750, 835], [620, 880], [560, 872], [405, 800]],
      front: [[405, 800], [560, 872], [620, 880], [750, 835]],
    },
    {
      id: "loopband-2",
      outline: [[640, 720], [650, 600], [665, 460], [700, 450], [800, 480], [855, 520], [855, 570], [800, 600], [965, 735], [965, 765], [860, 795], [760, 770]],
      front: [[640, 718], [844, 790], [965, 760]],
    },
    {
      id: "halterbank",
      outline: [[1172, 880], [1180, 800], [1205, 700], [1210, 590], [1200, 560], [1220, 510], [1300, 510], [1320, 560], [1440, 590], [1460, 575], [1520, 580], [1583, 640], [1583, 680], [1540, 720], [1540, 840], [1440, 840], [1306, 882]],
      front: [[1172, 860], [1306, 885], [1440, 840], [1540, 840]],
    },
    {
      id: "halterrek",
      outline: [[1567, 904], [1570, 800], [1600, 730], [1640, 660], [1800, 700], [1890, 740], [1906, 760], [1900, 990], [1800, 995]],
      front: [[1567, 905], [1800, 995], [1900, 990]],
    },
  ],
  seats: readSeats(zitplekken),
  doors: [{ id: "deur", label: "Naar buiten", tap: [[100, 460], [300, 375], [305, 825], [105, 865]], approach: [272, 900], to: "buiten", arrive: "sportschool" }],
  spots: [
    { id: "loopband-1", label: "Loopband", link: { label: "Training loggen", href: "/fitness/start" }, tap: [[405, 790], [430, 545], [655, 590], [750, 800], [620, 880]], approach: [770, 905], at: [590, 790], facing: "left", pose: "lopen" },
    { id: "loopband-2", label: "Loopband", link: { label: "Training loggen", href: "/fitness/start" }, tap: [[640, 720], [665, 460], [855, 520], [965, 735], [860, 795]], approach: [985, 800], at: [805, 705], facing: "left", pose: "lopen" },
    { id: "mat-groen", label: "Sprongsquats", tap: [[494, 1120], [820, 964], [900, 1000], [580, 1180]], approach: [697, 1072], at: [697, 1072], facing: "right", pose: "sprongsquat" },
    { id: "mat-oranje", label: "Sprongsquats", tap: [[714, 1200], [1040, 1016], [1114, 1054], [790, 1266]], approach: [914, 1141], at: [914, 1141], facing: "right", pose: "sprongsquat" },
    { id: "mat-rood", label: "Sprongsquats", tap: [[974, 1300], [1300, 1070], [1372, 1106], [1050, 1344]], approach: [1173, 1207], at: [1173, 1207], facing: "right", pose: "sprongsquat" },
  ],
  spawn: [300, 920],
  characterHeight: 340,
};
