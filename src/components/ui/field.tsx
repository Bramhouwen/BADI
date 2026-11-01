import * as React from "react";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block px-1 text-[13px] font-medium text-muted", className)} {...props} />;
}

export const inputClass =
  "w-full rounded-full border border-ink/10 bg-white/80 px-5 py-3.5 text-[16px] text-text placeholder:text-muted/70 shadow-sm outline-none transition focus:border-ink/30 focus:bg-white focus:ring-2 focus:ring-ink/10";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(inputClass, className)} {...props} />;
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(inputClass, "min-h-[96px] resize-y rounded-[24px]", className)} {...props} />;
  },
);

export function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 px-1 text-xs text-muted">{children}</p>;
}

export function ErrorText({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-2xl bg-danger/15 px-4 py-2.5 text-sm text-danger">
      {children}
    </p>
  );
}
