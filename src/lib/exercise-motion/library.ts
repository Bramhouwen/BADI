/**
 * Motion and tips per exercise for the animated figure. Keyed by a
 * normalised exercise name, so standard exercises match regardless of case
 * or punctuation. Coordinates live in a 200 x 190 canvas with the ground at
 * y = 176; the figure faces right.
 */
import type { FrontPose, Pt, SidePose } from "./skeleton";

export const GROUND = 176;

export type Prop =
  | { type: "barbell" }
  | { type: "dumbbells" }
  | { type: "line"; from: Pt; to: Pt; width?: number }
  | { type: "cable"; from: Pt }
  | { type: "pad" }
  | { type: "plate" }
  | { type: "ball" };

interface Base {
  /** Short how-to in Dutch, two or three lines. */
  cues: string[];
  /** Time per movement in milliseconds. */
  beatMs?: number;
  props?: Prop[];
}

export interface SideMotion extends Base {
  view: "side";
  frames: SidePose[];
  /** Keeps this joint (near side) on a fixed spot, so feet or hands do not slide. */
  anchor?: { joint: "ankle" | "toe" | "hand" | "hip"; at: Pt };
}

export interface FrontMotion extends Base {
  view: "front";
  frames: FrontPose[];
}

export type Motion = SideMotion | FrontMotion;

/** "Push-up", "push up" and "Pushup" all become "pushup". */
export function motionKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z0-9]/g, "");
}

const H: Pt = [100, 116];
const STAND: SidePose["legs"] = [
  [0, 0],
  [0, 0],
];
const DOWN: SidePose["arms"] = [
  [0, 0],
  [0, 0],
];
const STANDING_FEET: SideMotion["anchor"] = { joint: "ankle", at: [96, GROUND] };

const side = (m: Omit<SideMotion, "view">): SideMotion => ({ view: "side", ...m });
const front = (m: Omit<FrontMotion, "view">): FrontMotion => ({ view: "front", ...m });

const RAW: Record<string, Motion> = {
  // ---------------------------------------------------------------- legs
  Squat: side({
    anchor: STANDING_FEET,
    props: [{ type: "barbell" }],
    frames: [
      { hip: H, torso: 180, arms: [[320, 160], [320, 160]], legs: STAND },
      { hip: H, torso: 145, head: 160, arms: [[285, 125], [285, 125]], legs: [[82, 335], [82, 335]] },
    ],
    cues: ["Voeten op heupbreedte, tenen iets naar buiten.", "Zak met je heupen naar achteren tot je bovenbenen horizontaal zijn.", "Knieën in lijn met je tenen, borst omhoog, hielen op de grond."],
  }),
  "Leg Press": side({
    anchor: { joint: "hip", at: [78, 142] },
    props: [
      { type: "line", from: [62, 156], to: [40, 112], width: 8 },
      { type: "line", from: [60, 156], to: [96, 156], width: 8 },
      { type: "plate" },
    ],
    frames: [
      { hip: H, torso: 222, head: 200, arms: [[20, 70], [20, 70]], legs: [[148, 62], [148, 62]] },
      { hip: H, torso: 222, head: 200, arms: [[20, 70], [20, 70]], legs: [[112, 108], [112, 108]] },
    ],
    cues: ["Rug en billen plat tegen de rugleuning.", "Duw de plaat weg met je hele voet, niet alleen je tenen.", "Strek je benen bijna helemaal, zonder je knieën op slot te zetten."],
  }),
  Lunges: side({
    anchor: { joint: "ankle", at: [70, GROUND] },
    props: [{ type: "dumbbells" }],
    frames: [
      { hip: H, torso: 180, arms: DOWN, legs: STAND },
      { hip: H, torso: 180, arms: DOWN, legs: [[88, 0], [345, 275]] },
    ],
    cues: ["Stap ruim naar voren en zak recht naar beneden.", "Voorste knie boven je enkel, achterste knie net boven de grond.", "Duw je terug via je voorste hiel."],
  }),
  "Romanian Deadlift": side({
    anchor: STANDING_FEET,
    props: [{ type: "barbell" }],
    frames: [
      { hip: H, torso: 180, arms: [[5, 5], [5, 5]], legs: STAND },
      { hip: H, torso: 100, head: 115, arms: [[2, 2], [2, 2]], legs: [[12, 352], [12, 352]] },
    ],
    cues: ["Knieën licht gebogen, die hoek blijft gelijk.", "Duw je heupen naar achteren en houd je rug recht.", "De stang glijdt langs je benen, tot net onder je knieën."],
  }),
  "Leg Extension": side({
    anchor: { joint: "hip", at: [84, 132] },
    props: [
      { type: "line", from: [66, 140], to: [118, 140], width: 8 },
      { type: "line", from: [70, 140], to: [64, 90], width: 8 },
      { type: "pad" },
    ],
    frames: [
      { hip: H, torso: 185, arms: [[15, 70], [15, 70]], legs: [[90, 5], [90, 5]] },
      { hip: H, torso: 185, arms: [[15, 70], [15, 70]], legs: [[90, 88], [90, 88]] },
    ],
    cues: ["Rug tegen de leuning, knieën bij het draaipunt.", "Strek je benen rustig tot ze bijna recht zijn.", "Laat gecontroleerd zakken, niet laten vallen."],
  }),
  "Leg Curl": side({
    anchor: { joint: "hip", at: [96, 140] },
    props: [{ type: "line", from: [40, 150], to: [160, 150], width: 8 }, { type: "pad" }],
    frames: [
      { hip: H, torso: 90, head: 100, arms: [[55, 95], [55, 95]], legs: [[270, 270], [270, 270]] },
      { hip: H, torso: 90, head: 100, arms: [[55, 95], [55, 95]], legs: [[272, 185], [272, 185]] },
    ],
    cues: ["Heupen plat op de bank houden.", "Buig je knieën en breng je hielen richting je billen.", "Laat langzaam terugzakken tot je benen bijna gestrekt zijn."],
  }),
  "Calf Raise": side({
    anchor: { joint: "toe", at: [104, GROUND] },
    props: [{ type: "dumbbells" }],
    frames: [
      { hip: H, torso: 180, arms: DOWN, legs: STAND, feet: [90, 90] },
      { hip: H, torso: 180, arms: DOWN, legs: STAND, feet: [35, 35] },
    ],
    cues: ["Sta rechtop op de bal van je voeten.", "Kom zo hoog mogelijk op je tenen en houd één tel vast.", "Laat je hielen langzaam weer zakken."],
  }),

  // --------------------------------------------------------------- chest
  "Bench Press": side({
    anchor: { joint: "hip", at: [112, 146] },
    props: [
      { type: "line", from: [40, 153], to: [118, 153], width: 7 },
      { type: "line", from: [52, 156], to: [52, GROUND], width: 4 },
      { type: "line", from: [108, 156], to: [108, GROUND], width: 4 },
      { type: "barbell" },
    ],
    frames: [
      { hip: H, torso: 270, head: 270, arms: [[60, 170], [60, 170]], legs: [[95, 2], [95, 2]] },
      { hip: H, torso: 270, head: 270, arms: [[176, 180], [176, 180]], legs: [[95, 2], [95, 2]] },
    ],
    cues: ["Schouderbladen samen en naar beneden, voeten plat op de grond.", "Laat de stang gecontroleerd zakken tot op je borst.", "Duw recht omhoog tot je armen gestrekt zijn."],
  }),
  "Incline Dumbbell Press": side({
    anchor: { joint: "hip", at: [100, 146] },
    props: [
      { type: "line", from: [92, 152], to: [56, 102], width: 7 },
      { type: "line", from: [86, 154], to: [124, 154], width: 7 },
      { type: "dumbbells" },
    ],
    frames: [
      { hip: H, torso: 222, head: 205, arms: [[335, 150], [335, 150]], legs: [[90, 0], [90, 0]] },
      { hip: H, torso: 222, head: 205, arms: [[148, 150], [148, 150]], legs: [[90, 0], [90, 0]] },
    ],
    cues: ["Bank op ongeveer 30 graden.", "Start met de dumbbells naast je borst, ellebogen iets onder schouderhoogte.", "Duw omhoog en iets naar elkaar toe."],
  }),
  "Chest Fly": front({
    props: [{ type: "dumbbells" }],
    frames: [
      { hip: H, arms: [[82, 96], [82, 96]], legs: [[4, 4], [4, 4]] },
      { hip: H, arms: [[30, -118], [30, -118]], legs: [[4, 4], [4, 4]] },
    ],
    cues: ["Ellebogen licht gebogen, die hoek blijft gelijk.", "Open je armen wijd tot je een rek in je borst voelt.", "Breng je handen in een boog terug voor je borst."],
  }),
  "Push-up": side({
    anchor: { joint: "toe", at: [44, GROUND] },
    frames: [
      { hip: H, torso: 115, head: 105, arms: DOWN, legs: [[290, 290], [290, 290]] },
      { hip: H, torso: 100, head: 95, arms: [[300, 50], [300, 50]], legs: [[280, 280], [280, 280]] },
    ],
    cues: ["Handen iets breder dan je schouders, lichaam in één rechte lijn.", "Zak tot je borst bijna de grond raakt, ellebogen schuin naar achteren.", "Duw jezelf omhoog zonder dat je heupen doorzakken."],
  }),

  // ---------------------------------------------------------------- back
  "Lat Pulldown": side({
    anchor: { joint: "hip", at: [96, 140] },
    props: [
      { type: "line", from: [70, 146], to: [116, 146], width: 7 },
      { type: "cable", from: [104, 4] },
      { type: "barbell" },
    ],
    frames: [
      { hip: H, torso: 188, head: 185, arms: [[176, 178], [176, 178]], legs: [[90, 0], [90, 0]] },
      { hip: H, torso: 192, head: 182, arms: [[345, 168], [345, 168]], legs: [[90, 0], [90, 0]] },
    ],
    cues: ["Pak de stang iets breder dan schouderbreedte.", "Trek de stang naar je bovenborst, ellebogen naar beneden.", "Laat rustig terug omhoog tot je armen gestrekt zijn."],
  }),
  "Seated Row": side({
    anchor: { joint: "hip", at: [70, 150] },
    props: [
      { type: "line", from: [40, 157], to: [86, 157], width: 7 },
      { type: "cable", from: [196, 132] },
    ],
    frames: [
      { hip: H, torso: 168, arms: [[96, 92], [96, 92]], legs: [[96, 70], [96, 70]] },
      { hip: H, torso: 182, arms: [[330, 85], [330, 85]], legs: [[96, 70], [96, 70]] },
    ],
    cues: ["Zit rechtop met licht gebogen knieën.", "Trek de handgrepen naar je buik en knijp je schouderbladen samen.", "Strek je armen weer zonder je rug rond te maken."],
  }),
  "Bent-over Row": side({
    anchor: STANDING_FEET,
    props: [{ type: "barbell" }],
    frames: [
      { hip: H, torso: 112, head: 120, arms: DOWN, legs: [[14, 350], [14, 350]] },
      { hip: H, torso: 112, head: 120, arms: [[290, 0], [290, 0]], legs: [[14, 350], [14, 350]] },
    ],
    cues: ["Buig voorover met een rechte rug, knieën licht gebogen.", "Trek de stang naar je navel, ellebogen langs je lichaam.", "Laat gecontroleerd zakken tot je armen gestrekt zijn."],
  }),
  "Pull-up": side({
    anchor: { joint: "hand", at: [108, 26] },
    props: [{ type: "line", from: [70, 26], to: [150, 26], width: 5 }],
    frames: [
      { hip: H, torso: 180, arms: [[178, 178], [178, 178]], legs: [[8, 340], [8, 340]] },
      { hip: H, torso: 175, head: 180, arms: [[350, 172], [350, 172]], legs: [[12, 335], [12, 335]] },
    ],
    cues: ["Hang met gestrekte armen, handen iets breder dan je schouders.", "Trek jezelf op tot je kin boven de stang is.", "Laat jezelf rustig zakken, zonder te zwaaien."],
  }),

  // ----------------------------------------------------------- shoulders
  "Shoulder Press": front({
    props: [{ type: "dumbbells" }],
    frames: [
      { hip: H, arms: [[92, 178], [92, 178]], legs: [[5, 5], [5, 5]] },
      { hip: H, arms: [[168, 176], [168, 176]], legs: [[5, 5], [5, 5]] },
    ],
    cues: ["Start met de dumbbells op schouderhoogte.", "Duw recht omhoog boven je hoofd.", "Buik aangespannen, niet hol in je onderrug."],
  }),
  "Lateral Raise": front({
    props: [{ type: "dumbbells" }],
    frames: [
      { hip: H, arms: [[12, 12], [12, 12]], legs: [[5, 5], [5, 5]] },
      { hip: H, arms: [[86, 92], [86, 92]], legs: [[5, 5], [5, 5]] },
    ],
    cues: ["Ellebogen licht gebogen.", "Til je armen zijwaarts op tot schouderhoogte.", "Laat langzaam zakken, niet zwaaien."],
  }),
  "Rear Delt Fly": side({
    anchor: STANDING_FEET,
    props: [{ type: "dumbbells" }],
    frames: [
      { hip: H, torso: 108, head: 118, arms: [[5, 15], [5, 15]], legs: [[12, 352], [12, 352]] },
      { hip: H, torso: 108, head: 118, arms: [[225, 235], [225, 235]], legs: [[12, 352], [12, 352]] },
    ],
    cues: ["Buig voorover met een rechte rug.", "Til je armen wijd zijwaarts op, ellebogen licht gebogen.", "Knijp je schouderbladen samen en laat rustig zakken."],
  }),

  // ---------------------------------------------------------------- arms
  "Bicep Curl": side({
    anchor: STANDING_FEET,
    props: [{ type: "dumbbells" }],
    frames: [
      { hip: H, torso: 180, arms: [[3, 3], [3, 3]], legs: STAND },
      { hip: H, torso: 180, arms: [[8, 160], [8, 160]], legs: STAND },
    ],
    cues: ["Ellebogen blijven naast je lichaam.", "Krul de gewichten omhoog richting je schouders.", "Laat gecontroleerd zakken tot je armen gestrekt zijn."],
  }),
  "Hammer Curl": side({
    anchor: STANDING_FEET,
    props: [{ type: "dumbbells" }],
    frames: [
      { hip: H, torso: 180, arms: [[3, 3], [3, 3]], legs: STAND },
      { hip: H, torso: 180, arms: [[8, 150], [8, 150]], legs: STAND },
    ],
    cues: ["Duimen wijzen naar boven, als bij een hamer.", "Ellebogen naast je lichaam, alleen je onderarmen bewegen.", "Rustig omhoog en rustig weer naar beneden."],
  }),
  "Tricep Pushdown": side({
    anchor: STANDING_FEET,
    props: [{ type: "cable", from: [132, 4] }],
    frames: [
      { hip: H, torso: 175, arms: [[8, 120], [8, 120]], legs: STAND },
      { hip: H, torso: 175, arms: [[8, 5], [8, 5]], legs: STAND },
    ],
    cues: ["Ellebogen tegen je zij, die bewegen niet.", "Duw de kabel naar beneden tot je armen gestrekt zijn.", "Laat langzaam terugkomen tot borsthoogte."],
  }),
  "Tricep Extension": side({
    anchor: STANDING_FEET,
    props: [{ type: "dumbbells" }],
    frames: [
      { hip: H, torso: 180, arms: [[170, 330], [170, 330]], legs: STAND },
      { hip: H, torso: 180, arms: [[172, 176], [172, 176]], legs: STAND },
    ],
    cues: ["Houd de dumbbell met twee handen boven je hoofd.", "Laat hem achter je hoofd zakken, ellebogen wijzen naar voren.", "Strek je armen weer volledig."],
  }),

  // ---------------------------------------------------------------- core
  Plank: side({
    anchor: { joint: "toe", at: [40, GROUND] },
    beatMs: 1800,
    frames: [
      { hip: H, torso: 98, head: 95, arms: [[0, 90], [0, 90]], legs: [[278, 278], [278, 278]] },
      { hip: H, torso: 97, head: 95, arms: [[1, 90], [1, 90]], legs: [[279, 279], [279, 279]] },
    ],
    cues: ["Ellebogen onder je schouders, lichaam in één rechte lijn.", "Span je buik en billen aan, heupen niet laten zakken.", "Blijf rustig doorademen en houd de positie vast."],
  }),
  Crunch: side({
    anchor: { joint: "hip", at: [104, 168] },
    frames: [
      { hip: H, torso: 270, head: 262, arms: [[120, 95], [120, 95]], legs: [[140, 30], [140, 30]] },
      { hip: H, torso: 236, head: 215, spine: -0.6, arms: [[118, 105], [118, 105]], legs: [[140, 30], [140, 30]] },
    ],
    cues: ["Lig op je rug met gebogen knieën, voeten plat.", "Rol je schouders van de grond door je buik aan te spannen.", "Kin een vuist van je borst, niet aan je nek trekken."],
  }),
  "Leg Raise": side({
    anchor: { joint: "hip", at: [84, 168] },
    frames: [
      { hip: H, torso: 270, head: 270, arms: [[92, 92], [92, 92]], legs: [[93, 93], [93, 93]] },
      { hip: H, torso: 270, head: 270, arms: [[92, 92], [92, 92]], legs: [[178, 178], [178, 178]] },
    ],
    cues: ["Lig op je rug, onderrug tegen de grond.", "Til je gestrekte benen op tot ze recht omhoog wijzen.", "Laat ze langzaam zakken tot net boven de grond."],
  }),
  "Russian Twist": front({
    beatMs: 900,
    props: [{ type: "ball" }],
    frames: [
      { hip: [100, 150], lean: -10, arms: [[50, 50], [-50, -50]], legs: [[162, 18], [162, 18]] },
      { hip: [100, 150], lean: 10, arms: [[-50, -50], [50, 50]], legs: [[162, 18], [162, 18]] },
    ],
    cues: ["Zit met gebogen knieën en leun iets achterover.", "Draai je bovenlichaam van links naar rechts.", "Houd je rug recht en je buik aangespannen."],
  }),

  // ---------------------------------------------- warming-up & mobility
  "Jumping Jacks": front({
    beatMs: 550,
    frames: [
      { hip: H, arms: [[12, 12], [12, 12]], legs: [[3, 3], [3, 3]] },
      { hip: [100, 110], arms: [[165, 175], [165, 175]], legs: [[18, 18], [18, 18]] },
    ],
    cues: ["Spring met je benen wijd en zwaai je armen boven je hoofd.", "Spring terug met je benen samen en armen langs je zij.", "Land zacht op de bal van je voeten."],
  }),
  "Arm Circles": front({
    beatMs: 380,
    frames: [
      { hip: H, arms: [[80, 80], [80, 80]], legs: [[4, 4], [4, 4]] },
      { hip: H, arms: [[92, 92], [92, 92]], legs: [[4, 4], [4, 4]] },
      { hip: H, arms: [[100, 100], [100, 100]], legs: [[4, 4], [4, 4]] },
    ],
    cues: ["Strek je armen zijwaarts op schouderhoogte.", "Maak kleine cirkels en maak ze langzaam groter.", "Wissel na een tijdje van richting."],
  }),
  "High Knees": side({
    beatMs: 420,
    frames: [
      { hip: H, torso: 180, arms: [[330, 120], [40, 150]], legs: [[90, 0], [0, 0]] },
      { hip: H, torso: 180, arms: [[40, 150], [330, 120]], legs: [[0, 0], [90, 0]] },
    ],
    cues: ["Ren op de plaats en trek je knieën tot heuphoogte.", "Zwaai je armen mee, tegengesteld aan je benen.", "Blijf licht op de bal van je voeten."],
  }),
  "Leg Swings": side({
    anchor: { joint: "ankle", at: [92, GROUND] },
    beatMs: 750,
    frames: [
      { hip: H, torso: 180, arms: [[80, 95], [80, 95]], legs: [[0, 0], [320, 320]] },
      { hip: H, torso: 180, arms: [[80, 95], [80, 95]], legs: [[0, 0], [65, 65]] },
    ],
    cues: ["Steun met één hand tegen een muur.", "Zwaai je been ontspannen naar voren en naar achteren.", "Maak de zwaai rustig groter, na 10 keer ander been."],
  }),
  "Glute Bridge": side({
    anchor: { joint: "ankle", at: [130, GROUND] },
    frames: [
      { hip: H, torso: 270, head: 270, arms: [[90, 90], [90, 90]], legs: [[135, 25], [135, 25]] },
      { hip: H, torso: 290, head: 272, arms: [[92, 92], [92, 92]], legs: [[105, 10], [105, 10]] },
    ],
    cues: ["Lig op je rug, voeten plat op heupbreedte.", "Duw je heupen omhoog tot je lichaam een rechte lijn is.", "Knijp je billen aan en zak rustig terug."],
  }),
  "Cat-Cow": side({
    anchor: { joint: "hip", at: [72, 146] },
    beatMs: 1400,
    frames: [
      { hip: H, torso: 112, head: 30, spine: -1, arms: DOWN, legs: [[0, 270], [0, 270]] },
      { hip: H, torso: 112, head: 150, spine: 0.9, arms: DOWN, legs: [[0, 270], [0, 270]] },
    ],
    cues: ["Begin op handen en knieën.", "Maak je rug bol en kijk naar je navel.", "Laat je rug hol zakken en kijk omhoog, in je eigen ademritme."],
  }),
  "Bird Dog": side({
    anchor: { joint: "hip", at: [72, 146] },
    beatMs: 1200,
    frames: [
      { hip: H, torso: 112, head: 110, arms: DOWN, legs: [[0, 270], [0, 270]] },
      { hip: H, torso: 108, head: 100, arms: [[100, 100], [0, 0]], legs: [[0, 270], [278, 278]] },
    ],
    cues: ["Begin op handen en knieën, rug recht.", "Strek tegelijk één arm naar voren en het andere been naar achteren.", "Houd twee tellen vast en wissel van kant."],
  }),
  "Downward Dog": side({
    anchor: { joint: "toe", at: [62, GROUND] },
    beatMs: 1300,
    frames: [
      { hip: H, torso: 55, head: 40, arms: [[45, 45], [45, 45]], legs: [[340, 340], [340, 340]] },
      { hip: H, torso: 55, head: 40, arms: [[45, 45], [45, 45]], legs: [[10, 318], [340, 340]], feet: [65, 70] },
    ],
    cues: ["Handen en voeten op de grond, heupen hoog: een omgekeerde V.", "Duw de grond weg en maak je rug lang.", "Trap afwisselend je hielen richting de grond."],
  }),
  "Hip Flexor Stretch": side({
    anchor: { joint: "ankle", at: [128, GROUND] },
    beatMs: 1500,
    frames: [
      { hip: H, torso: 180, arms: [[178, 178], [178, 178]], legs: [[90, 0], [345, 270]] },
      { hip: H, torso: 186, head: 182, arms: [[184, 184], [184, 184]], legs: [[102, 16], [338, 268]] },
    ],
    cues: ["Kniel op één knie, andere voet plat voor je.", "Span je billen aan en duw je heup rustig naar voren.", "Voel de rek voor in je heup en wissel na 30 seconden."],
  }),
  Inchworm: side({
    anchor: { joint: "toe", at: [40, GROUND] },
    beatMs: 1300,
    frames: [
      { hip: H, torso: 180, arms: DOWN, legs: STAND },
      { hip: H, torso: 70, head: 50, arms: [[15, 15], [15, 15]], legs: [[4, 356], [4, 356]] },
      { hip: H, torso: 115, head: 105, arms: DOWN, legs: [[290, 290], [290, 290]] },
    ],
    cues: ["Buig voorover en zet je handen voor je voeten op de grond.", "Loop met je handen naar voren tot een plank.", "Loop met je handen terug en kom rustig omhoog."],
  }),
};

export const MOTIONS: Record<string, Motion> = Object.fromEntries(Object.entries(RAW).map(([name, m]) => [motionKey(name), m]));

export function motionFor(name: string): Motion | null {
  return MOTIONS[motionKey(name)] ?? null;
}

/** Warming-up and mobility exercises that migration 0018 adds as standard exercises. */
export const MOBILITY_EXERCISES = ["Jumping Jacks", "Arm Circles", "High Knees", "Leg Swings", "Glute Bridge", "Cat-Cow", "Bird Dog", "Downward Dog", "Hip Flexor Stretch", "Inchworm"] as const;

export const ANIMATED_EXERCISES = Object.keys(RAW);
