import Link from "next/link";
import { cn } from "@/lib/utils";

const items = [
  { href: "/fitness", label: "Overzicht" },
  { href: "/fitness/start", label: "Starten" },
  { href: "/fitness/plans", label: "Schema's" },
  { href: "/fitness/exercises", label: "Oefeningen" },
  { href: "/fitness/history", label: "Geschiedenis" },
  { href: "/fitness/progress", label: "Progressie" },
] as const;

/** Secondary navigation of the Fitness module: a quiet chip row, never a second tab bar. */
export function FitnessNav({ active }: { active: (typeof items)[number]["href"] }) {
  return (
    <nav aria-label="Fitness" className="no-scrollbar -mx-5 mb-4 flex gap-2 overflow-x-auto px-5 pb-1">
      {items.map((it) => {
        const on = it.href === active;
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={on ? "page" : undefined}
            className={cn("shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition", on ? "espresso shadow-none" : "soft hover:bg-blush-2")}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
