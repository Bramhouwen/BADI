"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUp } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";

export const BADDY_PHOTO = "/brand/baddy.jpg";

/** Link that opens the coach and sends the question straight away. */
export function askHref(question: string): string {
  return `/coach?q=${encodeURIComponent(question)}&send=1`;
}

/** Question field that hands the question to Baddy and opens the conversation. */
export function AskField({ placeholder = "Vraag Baddy iets", autoFocus = false, onSent }: { placeholder?: string; autoFocus?: boolean; onSent?: () => void }) {
  const [q, setQ] = useState("");
  const router = useRouter();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const question = q.trim();
        if (!question) return;
        onSent?.();
        router.push(askHref(question));
      }}
      className="flex items-center gap-1.5 rounded-full bg-white/90 p-1 pl-4 shadow-sm ring-1 ring-ink/[0.06]"
    >
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        aria-label="Vraag aan Baddy"
        maxLength={400}
        autoFocus={autoFocus}
        enterKeyHint="send"
        className="min-w-0 flex-1 bg-transparent py-2 text-[14px] text-text outline-none placeholder:text-muted"
      />
      <button type="submit" disabled={!q.trim()} aria-label="Vraag versturen" className="espresso flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-none disabled:opacity-40">
        <ArrowUp className="h-[17px] w-[17px]" strokeWidth={2} />
      </button>
    </form>
  );
}

/** Home: Baddy with her photo, a question field and two one-tap questions. */
export function BaddyAsk() {
  return (
    <section className="glass rounded-[22px] p-4" aria-label="Vraag Baddy">
      <div className="flex items-center gap-3">
        <Link href="/coach" aria-label="Open je gesprek met Baddy" className="relative shrink-0">
          <Avatar name="Baddy" src={BADDY_PHOTO} size="lg" className="h-14 w-14 ring-[3px] ring-sage/60" />
          <span className="absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full bg-sage ring-2 ring-white" aria-hidden />
        </Link>
        <div className="min-w-0">
          <p className="font-display text-[19px] leading-tight text-text">Vraag Baddy</p>
          <p className="text-[11.5px] leading-snug text-muted">Je coach voor eten, training, water en slaap.</p>
        </div>
      </div>
      <div className="mt-3">
        <AskField placeholder="Wat wil je weten?" />
      </div>
      <div className="no-scrollbar -mx-4 mt-2.5 flex gap-2 overflow-x-auto px-4">
        {["Maak een avondeten met veel eiwit", "Tips voor 10.000 stappen", "Wat eet ik na het sporten?"].map((q) => (
          <Link key={q} href={askHref(q)} className="soft shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-medium text-ink">
            {q}
          </Link>
        ))}
      </div>
    </section>
  );
}
