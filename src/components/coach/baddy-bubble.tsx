"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Avatar } from "@/components/ui/avatar";
import { AskField, BADDY_PHOTO, askHref } from "./baddy-ask";

/** Pages where the bubble would cover a composer or duplicate an entry point. */
function hiddenOn(path: string): boolean {
  if (path === "/" || path.startsWith("/coach") || path.startsWith("/squad") || path.startsWith("/profile") || path.startsWith("/checkin")) return true;
  if (path.endsWith("/new") || path.endsWith("/edit")) return true;
  if (path.startsWith("/fitness/workout") || path.startsWith("/fitness/start/")) return true;
  return false;
}

/** Pages with their own floating "+" button: the bubble sits above it. */
function hasFab(path: string): boolean {
  return path === "/kitchen" || path === "/wall";
}

function suggestionsFor(path: string): string[] {
  if (path.startsWith("/fitness")) return ["Maak een krachtschema voor 3 keer per week", "Hoe bouw ik op naar 5 km hardlopen?"];
  if (path.startsWith("/kitchen")) return ["Maak een avondeten zonder toegevoegde suikers", "Snel ontbijt met veel eiwit"];
  if (path.startsWith("/water")) return ["Tips om 3 liter water per dag te drinken"];
  return ["Wat kan ik vandaag nog doen voor mijn doelen?", "Tips om beter te slapen"];
}

function Bubble() {
  const path = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  if (hiddenOn(path)) return null;
  const offset = hasFab(path) ? 92 : 20;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Vraag Baddy"
        className="fixed right-5 z-30 transition active:scale-95"
        style={{ bottom: `calc(var(--nav-h) + var(--sab) + ${offset}px)` }}
      >
        <span className="relative block">
          <Avatar name="Baddy" src={BADDY_PHOTO} size="lg" className="h-14 w-14 shadow-[0_12px_26px_-12px_rgba(95,53,41,0.7)] ring-[3px] ring-white" />
          <span className="espresso absolute -left-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full shadow-none ring-2 ring-white" aria-hidden>
            <MessageCircle className="h-3.5 w-3.5" strokeWidth={2} />
          </span>
        </span>
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Vraag Baddy">
        <div className="space-y-3 pb-2">
          <div className="flex items-center gap-3">
            <Avatar name="Baddy" src={BADDY_PHOTO} size="md" className="ring-2 ring-sage/60" />
            <p className="text-[13px] leading-snug text-muted">Stel je vraag. Je antwoord komt in je gesprek met Baddy.</p>
          </div>
          <AskField autoFocus onSent={() => setOpen(false)} />
          <div className="flex flex-wrap gap-2">
            {suggestionsFor(path).map((q) => (
              <Link key={q} href={askHref(q)} onClick={() => setOpen(false)} className="soft rounded-full px-3 py-1.5 text-[12.5px] font-medium text-ink">
                {q}
              </Link>
            ))}
          </div>
          <Link href="/coach" onClick={() => setOpen(false)} className="block pt-1 text-center text-[13px] font-medium text-ink underline-offset-2 hover:underline">
            Open je gesprek
          </Link>
        </div>
      </Sheet>
    </>
  );
}

/** Floating chat bubble with Baddy's photo; reads the URL, so it streams in behind Suspense. */
export function BaddyBubble() {
  return (
    <Suspense fallback={null}>
      <Bubble />
    </Suspense>
  );
}
