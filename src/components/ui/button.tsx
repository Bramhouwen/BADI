"use client";

import * as React from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline" | "dark";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary: "espresso font-semibold hover:brightness-110 active:scale-[0.98]",
  dark: "espresso font-semibold hover:brightness-110 active:scale-[0.98]",
  secondary: "bg-white text-ink font-medium border border-ink/10 shadow-sm hover:bg-blush active:scale-[0.98]",
  outline: "border border-ink/15 text-ink hover:bg-blush active:scale-[0.98]",
  ghost: "text-muted hover:text-ink hover:bg-blush active:scale-[0.98]",
  danger: "bg-danger/15 text-danger hover:bg-danger/25 active:scale-[0.98]",
};

const sizes: Record<Size, string> = {
  sm: "h-10 px-4 text-[13px] rounded-full",
  md: "h-12 px-5 text-[14px] rounded-full",
  lg: "h-[52px] px-6 text-[15px] rounded-full",
  icon: "h-11 w-11 rounded-full",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading = false, disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 select-none whitespace-nowrap transition-[background-color,transform,opacity,filter] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-water-deep disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
});

/** Round icon button with a thin glass border, like the header controls in the reference. */
export function CircleButton({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "flex h-11 w-11 items-center justify-center rounded-full border border-ink/10 bg-white text-ink shadow-sm transition hover:bg-blush active:scale-95",
        className,
      )}
      {...props}
    />
  );
}
