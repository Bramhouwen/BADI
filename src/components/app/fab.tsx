import Link from "next/link";
import { Plus } from "lucide-react";

export function Fab({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="fixed right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-ice text-bg shadow-[0_12px_30px_-8px_rgba(56,189,248,0.7)] transition active:scale-95"
      style={{ bottom: "calc(var(--nav-h) + var(--sab) + 16px)" }}
    >
      <Plus className="h-7 w-7" strokeWidth={2.5} />
    </Link>
  );
}
