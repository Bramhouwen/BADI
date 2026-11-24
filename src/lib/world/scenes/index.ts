/** Every scene of World of Badi by id. */
import type { SceneDef } from "../engine/scene";
import { BUITEN } from "./buiten";
import { KANTOOR } from "./kantoor";
import { SPORTSCHOOL } from "./sportschool";
import { ROOMS, SPACE_ROOMS } from "./kamers";
import { ACHTERTUIN } from "./huis";
import { HUIS } from "./poppenhuis";

export const SCENES: Record<string, SceneDef> = {
  [HUIS.id]: HUIS,
  [BUITEN.id]: BUITEN,
  [KANTOOR.id]: KANTOOR,
  [SPORTSCHOOL.id]: SPORTSCHOOL,
  [ACHTERTUIN.id]: ACHTERTUIN,
  ...Object.fromEntries(ROOMS.map((r) => [r.id, r])),
  ...Object.fromEntries(SPACE_ROOMS.map((r) => [r.id, r])),
};

export const FIRST_SCENE = HUIS.id;
