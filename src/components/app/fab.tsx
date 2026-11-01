import Link from "next/link";
import { Plus } from "lucide-react";

export function Fab({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="espresso fixed right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full transition active:scale-95"
      style={{ bottom: "calc(var(--nav-h) + var(--sab) + 20px)" }}
    >
      <Plus className="h-6 w-6" strokeWidth={1.8} />
    </Link>
  );
}
