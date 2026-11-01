import { Dumbbell, Droplets, Footprints, Moon, Salad, Wine, type LucideIcon } from "lucide-react";
import type { ActivityKey } from "./constants";

export const ACTIVITY_ICONS: Record<ActivityKey, LucideIcon> = {
  moved: Footprints,
  strength: Dumbbell,
  nutrition: Salad,
  recovery: Moon,
  hydration: Droplets,
  alcohol: Wine,
};
