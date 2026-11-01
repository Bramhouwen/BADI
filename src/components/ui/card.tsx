import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "glass" | "tile" | "dark" | "blush" | "sage";

const variants: Record<Variant, string> = {
  glass: "glass text-text",
  tile: "tile",
  dark: "espresso",
  blush: "bg-sand text-text shadow-[0_10px_30px_-22px_rgba(110,64,52,0.35)]",
  sage: "bg-sage-card text-text shadow-[0_10px_30px_-22px_rgba(110,64,52,0.35)]",
};

export function Card({
  className,
  elevated,
  variant,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { elevated?: boolean; variant?: Variant }) {
  const v: Variant = variant ?? (elevated ? "tile" : "glass");
  return <div className={cn("rounded-[22px] p-4", variants[v], className)} {...props} />;
}

export function SectionTitle({ children, action, className }: { children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-3 flex items-end justify-between px-1", className)}>
      <h2 className="font-display text-[20px] text-text">{children}</h2>
      {action}
    </div>
  );
}

/** Small rounded status badge, like "Good" or "Average" in the reference. */
export function Badge({ children, tone = "ink", className }: { children: React.ReactNode; tone?: "ink" | "ice" | "warm" | "gold" | "success"; className?: string }) {
  const tones = {
    ink: "soft",
    ice: "bg-water/30 text-ink",
    warm: "bg-warm/30 text-ink",
    gold: "bg-gold/30 text-ink",
    success: "bg-sage/30 text-ink",
  };
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium", tones[tone], className)}>{children}</span>;
}
