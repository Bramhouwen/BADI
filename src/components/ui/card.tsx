import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "glass" | "tile" | "dark";

const variants: Record<Variant, string> = {
  glass: "glass text-text",
  tile: "tile",
  dark: "bg-ink/80 text-text border border-white/10 shadow-[0_18px_40px_-22px_rgba(0,0,0,0.7)]",
};

export function Card({
  className,
  elevated,
  variant,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { elevated?: boolean; variant?: Variant }) {
  const v: Variant = variant ?? (elevated ? "tile" : "glass");
  return <div className={cn("rounded-[24px] p-4", variants[v], className)} {...props} />;
}

export function SectionTitle({ children, action, className }: { children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-3 flex items-end justify-between px-1", className)}>
      <h2 className="text-[19px] font-semibold tracking-tight">{children}</h2>
      {action}
    </div>
  );
}

/** Small rounded status badge, like "Good" or "Average" in the reference. */
export function Badge({ children, tone = "ink", className }: { children: React.ReactNode; tone?: "ink" | "ice" | "warm" | "gold" | "success"; className?: string }) {
  const tones = {
    ink: "bg-ink badge-ink",
    ice: "bg-ice text-ink",
    warm: "bg-warm text-ink",
    gold: "bg-gold text-ink",
    success: "bg-success text-ink",
  };
  return <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold", tones[tone], className)}>{children}</span>;
}
