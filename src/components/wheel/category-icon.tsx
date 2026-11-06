import { Apple, Droplet, Dumbbell, Flame, Gift, type LucideProps } from "lucide-react";
import type { WheelCategory } from "@/lib/wheel";

const ICONS = { food: Apple, hydration: Droplet, sport: Dumbbell, voucher: Gift, challenge: Flame } as const;

export function CategoryIcon({ category, ...props }: { category: WheelCategory } & LucideProps) {
  const Icon = ICONS[category];
  return <Icon aria-hidden {...props} />;
}
