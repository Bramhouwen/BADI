"use client";

import * as React from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline" | "dark";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary: "tile font-semibold hover:brightness-105 active:scale-[0.98]",
  dark: "bg-ink text-text font-semibold border border-white/10 hover:bg-[#122a42] active:scale-[0.98]",
  secondary: "glass text-text font-medium hover:bg-white/15 active:scale-[0.98]",
  outline: "border border-white/25 text-text hover:bg-white/10 active:scale-[0.98]",
  ghost: "text-muted hover:text-text hover:bg-white/10 active:scale-[0.98]",
  danger: "bg-danger/15 text-danger hover:bg-danger/25 active:scale-[0.98]",
};

const sizes: Record<Size, string> = {
  sm: "h-10 px-4 text-sm rounded-full",
  md: "h-12 px-5 text-[15px] rounded-full",
  lg: "h-14 px-6 text-base rounded-full",
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
        "inline-flex items-center justify-center gap-2 select-none whitespace-nowrap transition-[background-color,transform,opacity,filter] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ice/70 disabled:opacity-50 disabled:pointer-events-none",
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
        "flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-white/5 text-text backdrop-blur transition hover:bg-white/15 active:scale-95",
        className,
      )}
      {...props}
    />
  );
}
