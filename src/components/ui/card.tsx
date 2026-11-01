import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, elevated, ...props }: React.HTMLAttributes<HTMLDivElement> & { elevated?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-[20px] border border-border/70 p-4",
        elevated ? "bg-card-2" : "bg-card",
        className,
      )}
      {...props}
    />
  );
}

export function SectionTitle({ children, action, className }: { children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-3 flex items-end justify-between", className)}>
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">{children}</h2>
      {action}
    </div>
  );
}
