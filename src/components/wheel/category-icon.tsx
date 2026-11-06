import { Cookie, Crown, CupSoda, Flame, Gift, type LucideProps } from "lucide-react";
import type { WheelCategory } from "@/lib/wheel";

const ICONS = { small: Cookie, medium: CupSoda, large: Gift, jackpot: Crown, challenge: Flame } as const;

export function CategoryIcon({ category, ...props }: { category: WheelCategory } & LucideProps) {
  const Icon = ICONS[category];
  return <Icon aria-hidden {...props} />;
}
