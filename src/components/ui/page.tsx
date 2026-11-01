import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-lg px-5 pb-6 pt-1", className)}>{children}</div>;
}

export function PageTitle({ title, subtitle, back, action }: { title: ReactNode; subtitle?: ReactNode; back?: string; action?: ReactNode }) {
  return (
    <div className="mb-5">
      {back || action ? (
        <div className="mb-3 flex items-center justify-between">
          {back ? (
            <Link
              href={back}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-ink shadow-sm hover:bg-blush"
              aria-label="Terug"
            >
              <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.6} />
            </Link>
          ) : (
            <span />
          )}
          {action}
        </div>
      ) : null}
      <h1 className="font-display text-[28px] leading-tight">{title}</h1>
      {subtitle ? <p className="mt-1 text-[14px] text-muted">{subtitle}</p> : null}
    </div>
  );
}

/** Segmented pill tabs ("Alles" / "Mijn favorieten"). */
export function ChipTabs<T extends string>({
  value,
  options,
  onChange,
  hrefFor,
  label,
}: {
  value: T;
  options: { key: T; label: ReactNode }[];
  onChange?: (v: T) => void;
  hrefFor?: (v: T) => string;
  label: string;
}) {
  return (
    <div className="soft flex rounded-full p-1" role="tablist" aria-label={label}>
      {options.map((o) => {
        const active = o.key === value;
        const cls = cn(
          "flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-full px-2 py-2 text-center text-[13px] font-medium transition",
          active ? "bg-white text-ink shadow-sm" : "text-ink/70 hover:text-ink",
        );
        return hrefFor ? (
          <Link key={o.key} role="tab" aria-selected={active} href={hrefFor(o.key)} className={cls}>
            {o.label}
          </Link>
        ) : (
          <button key={o.key} type="button" role="tab" aria-selected={active} onClick={() => onChange?.(o.key)} className={cls}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
