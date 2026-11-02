import { Beef, Bike, Droplets, Dumbbell, Footprints, Moon, PersonStanding, Salad, Wine, type LucideIcon } from "lucide-react";
import type { ActivityKey } from "./constants";

export const ACTIVITY_ICONS: Record<ActivityKey, LucideIcon> = {
  steps: PersonStanding,
  hydration: Droplets,
  nutrition: Salad,
  protein: Beef,
  recovery: Moon,
  alcohol: Wine,
  run: Footprints,
  strength: Dumbbell,
  moved: Bike,
};
