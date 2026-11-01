import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-lg px-4 pb-6 pt-2", className)}>{children}</div>;
}

export function PageTitle({ title, subtitle, back, action }: { title: ReactNode; subtitle?: ReactNode; back?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-start gap-2">
        {back ? (
          <Link
            href={back}
            className="-ml-2 mt-0.5 flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-card hover:text-text"
            aria-label="Terug"
          >
            <ChevronLeft className="h-6 w-6" />
          </Link>
        ) : null}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle ? <p className="mt-0.5 text-sm text-muted">{subtitle}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}
