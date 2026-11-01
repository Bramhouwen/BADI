"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Home, Flame, ChefHat, Camera, Users } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/checkin", label: "Check-in", icon: Flame },
  { href: "/kitchen", label: "Kitchen", icon: ChefHat },
  { href: "/wall", label: "Wall", icon: Camera },
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

function NavItems({ pathname }: { pathname: string | null }) {
  const reduce = useReducedMotion();
  return (
    <ul className="mx-auto flex h-[var(--nav-h)] max-w-lg items-stretch">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname !== null && (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));
        return (
          <li key={href} className="flex-1">
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                active ? "text-ice" : "text-muted hover:text-text",
              )}
            >
              {active ? (
                <motion.span
                  layoutId={reduce ? undefined : "nav-indicator"}
                  className="absolute top-0 h-[3px] w-8 rounded-full bg-ice"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              ) : null}
              <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 2} aria-hidden />
              <span>{label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Reads the URL at request time; streams in behind Suspense so the shell stays static. */
function ActiveNavItems() {
  const pathname = usePathname();
  return <NavItems pathname={pathname} />;
}

export function BottomNav() {
  const keyboardOpen = useKeyboardOpen();

  return (
    <nav
      aria-label="Hoofdnavigatie"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-bg/85 backdrop-blur-xl transition-transform duration-200",
        keyboardOpen && "translate-y-full",
      )}
      style={{ paddingBottom: "var(--sab)" }}
    >
      <Suspense fallback={<NavItems pathname={null} />}>
        <ActiveNavItems />
      </Suspense>
    </nav>
  );
}
