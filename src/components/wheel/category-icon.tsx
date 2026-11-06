import { Apple, CupSoda, Cookie, Droplet, Dumbbell, Flame, Gift, GlassWater, Milk, Shirt, type LucideProps } from "lucide-react";
import type { SlotIcon, WheelCategory } from "@/lib/wheel";

const ICONS = { food: Apple, hydration: Droplet, sport: Dumbbell, voucher: Gift, challenge: Flame } as const;
const SLOT_ICONS = { drink: CupSoda, bar: Cookie, bottle: GlassWater, shaker: Milk, shirt: Shirt, gift: Gift, flame: Flame } as const;

export function CategoryIcon({ category, ...props }: { category: WheelCategory } & LucideProps) {
  const Icon = ICONS[category];
  return <Icon aria-hidden {...props} />;
}

export function SlotIconView({ icon, ...props }: { icon: SlotIcon } & LucideProps) {
  const Icon = SLOT_ICONS[icon];
  return <Icon aria-hidden {...props} />;
}
