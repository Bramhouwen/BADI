"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { Home, Flame, ChefHat, Dumbbell, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/fitness", label: "Fitness", icon: Dumbbell },
  { href: "/checkin", label: "Check-in", icon: Flame },
  { href: "/kitchen", label: "Kitchen", icon: ChefHat },
  { href: "/squad", label: "Squad", icon: Users },
] as const;

/** Hides the bar while a text field has focus so the keyboard never fights the nav. */
function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const isField = (el: EventTarget | null) =>
      el instanceof HTMLElement && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
    const onFocusIn = (e: FocusEvent) => isField(e.target) && setOpen(true);
    const onFocusOut = () => setTimeout(() => setOpen(isField(document.activeElement)), 50);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);
  return open;
}

function NavItems({ pathname, badges }: { pathname: string | null; badges?: Partial<Record<string, ReactNode>> }) {
  return (
    <ul className="flex items-stretch px-1.5 py-1">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname !== null && (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));
        return (
          <li key={href} className="flex-1">
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-[52px] flex-col items-center justify-center gap-0.5 rounded-full text-[10px] font-medium tracking-wide transition-colors",
                active ? "text-paper" : "text-paper/55 hover:text-paper/85",
              )}
            >
              <span className="relative">
                <Icon className="h-[20px] w-[20px]" strokeWidth={active ? 1.8 : 1.5} aria-hidden />
                {badges?.[href]}
              </span>
              <span>{label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Reads the URL at request time; streams in behind Suspense so the shell stays static. */
function ActiveNavItems({ badges }: { badges?: Partial<Record<string, ReactNode>> }) {
  const pathname = usePathname();
  return <NavItems pathname={pathname} badges={badges} />;
}

export function BottomNav({ squadBadge }: { squadBadge?: ReactNode }) {
  const badges = { "/squad": squadBadge };
  const keyboardOpen = useKeyboardOpen();

  return (
    <nav
      aria-label="Hoofdnavigatie"
      className={cn("pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 transition-transform duration-200", keyboardOpen && "translate-y-[140%]")}
      style={{ paddingBottom: "calc(var(--sab) + 8px)" }}
    >
      <div className="espresso pointer-events-auto w-full max-w-lg rounded-[24px]">
        <Suspense fallback={<NavItems pathname={null} badges={badges} />}>
          <ActiveNavItems badges={badges} />
        </Suspense>
      </div>
    </nav>
  );
}
