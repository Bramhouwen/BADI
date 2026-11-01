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
    <ul className="flex items-center gap-1.5 p-1.5">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname !== null && (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));
        return (
          <li key={href} className={cn(active ? "flex-[1.9]" : "flex-1")}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              aria-label={label}
              className={cn(
                "relative flex h-12 items-center justify-center gap-1.5 rounded-full text-[14px] font-semibold transition-colors",
                active ? "text-ink" : "text-ink/85 hover:text-ink",
              )}
            >
              <motion.span
                layoutId={reduce ? undefined : undefined}
                className={cn("absolute inset-0 rounded-full tile", active ? "opacity-100" : "opacity-100")}
                aria-hidden
              />
              <span className="relative flex items-center gap-1.5">
                <Icon className="h-[20px] w-[20px]" strokeWidth={active ? 2.4 : 2} aria-hidden />
                {active ? <span>{label}</span> : null}
              </span>
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
      className={cn("pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 transition-transform duration-200", keyboardOpen && "translate-y-[140%]")}
      style={{ paddingBottom: "calc(var(--sab) + 10px)" }}
    >
      <div className="pointer-events-auto w-full max-w-lg rounded-full border border-white/15 bg-ink/85 shadow-[0_18px_40px_-16px_rgba(0,0,0,0.8)] backdrop-blur-xl">
        <Suspense fallback={<NavItems pathname={null} />}>
          <ActiveNavItems />
        </Suspense>
      </div>
    </nav>
  );
}
