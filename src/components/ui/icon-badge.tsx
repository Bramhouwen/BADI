import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const sizes = {
  sm: { box: "h-9 w-9 rounded-[12px]", icon: 16 },
  md: { box: "h-11 w-11 rounded-[14px]", icon: 20 },
  lg: { box: "h-14 w-14 rounded-[18px]", icon: 24 },
} as const;

/** Thin line icon on a soft blush square, the recurring motif of the design. */
export function IconBadge({
  icon: Icon,
  size = "md",
  tone = "soft",
  className,
}: {
  icon: LucideIcon;
  size?: keyof typeof sizes;
  tone?: "soft" | "white" | "espresso" | "sage";
  className?: string;
}) {
  const tones = {
    soft: "soft",
    white: "bg-white text-ink border border-ink/10",
    espresso: "espresso shadow-none",
    sage: "bg-sage/25 text-ink",
  };
  return (
    <span className={cn("flex shrink-0 items-center justify-center", sizes[size].box, tones[tone], className)} aria-hidden>
      <Icon size={sizes[size].icon} strokeWidth={1.6} />
    </span>
  );
}
