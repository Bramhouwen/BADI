/** Every scene of World of Badi by id. */
import type { SceneDef } from "../engine/scene";
import { BUITEN } from "./buiten";
import { KANTOOR } from "./kantoor";
import { SPORTSCHOOL } from "./sportschool";
import { WOONKAMER } from "./woonkamer";
import { ROOMS, SPACE_ROOMS } from "./kamers";
import { ACHTERTUIN, HAL, OVERLOOP } from "./huis";

export const SCENES: Record<string, SceneDef> = {
  [WOONKAMER.id]: WOONKAMER,
  [BUITEN.id]: BUITEN,
  [KANTOOR.id]: KANTOOR,
  [SPORTSCHOOL.id]: SPORTSCHOOL,
  [HAL.id]: HAL,
  [OVERLOOP.id]: OVERLOOP,
  [ACHTERTUIN.id]: ACHTERTUIN,
  ...Object.fromEntries(ROOMS.map((r) => [r.id, r])),
  ...Object.fromEntries(SPACE_ROOMS.map((r) => [r.id, r])),
};

export const FIRST_SCENE = WOONKAMER.id;
