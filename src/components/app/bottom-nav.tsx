"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Home, Flame, ChefHat, Camera, Users } from "lucide-react";
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
  return (
    <ul className="flex items-stretch px-2 py-2">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname !== null && (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));
        return (
          <li key={href} className="flex-1">
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-14 flex-col items-center justify-center gap-1 rounded-full text-[11px] font-medium transition-colors",
                active ? "text-paper" : "text-paper/55 hover:text-paper/85",
              )}
            >
              <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 1.9 : 1.5} aria-hidden />
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
      className={cn("pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 transition-transform duration-200", keyboardOpen && "translate-y-[140%]")}
      style={{ paddingBottom: "calc(var(--sab) + 10px)" }}
    >
      <div className="espresso pointer-events-auto w-full max-w-lg rounded-[28px]">
        <Suspense fallback={<NavItems pathname={null} />}>
          <ActiveNavItems />
        </Suspense>
      </div>
    </nav>
  );
}
