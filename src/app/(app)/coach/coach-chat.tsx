"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUp, ChefHat, Dumbbell, RotateCcw } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { RichText } from "@/components/coach/rich-text";
import { clearCoachConversation } from "@/app/actions/coach";
import type { StoredRef } from "@/lib/coach/prompt";

export interface CoachMessage {
  id: string;
  role: "user" | "assistant";
  body: string;
  refs: StoredRef[];
  created_at: string;
  streaming?: boolean;
}

type CoachEvent =
  | { type: "status"; status: "thinking" | "working" }
  | { type: "text"; delta: string }
  | { type: "ref"; ref: StoredRef }
  | { type: "done"; id: string | null }
  | { type: "error"; message: string };

export const BADDY_AVATAR = "/brand/baddy.png";

const STARTERS = [
  "Maak drie ontbijtjes zonder toegevoegde suikers",
  "Maak een krachtschema voor 3 keer per week",
  "Hoe haal ik makkelijker 3 liter water?",
  "Wat eet ik na een avondtraining?",
  "Ik slaap slecht, waar begin ik?",
];

function RefCard({ refItem }: { refItem: StoredRef }) {
  const recipe = refItem.type === "recipe";
  return (
    <Link
      href={recipe ? `/kitchen/${refItem.id}` : `/fitness/plans/${refItem.id}`}
      className="glass flex items-center gap-3 rounded-[16px] py-2 pl-2 pr-3 hover:bg-blush/40"
    >
      <span className="soft flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
        {recipe ? <ChefHat className="h-[18px] w-[18px]" strokeWidth={1.6} /> : <Dumbbell className="h-[18px] w-[18px]" strokeWidth={1.6} />}
      </span>
      <span className="min-w-0">
        <span className="block text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted">{recipe ? "In de Kitchen" : "In Fitness"}</span>
        <span className="block truncate text-[13.5px] font-medium text-text">{refItem.name}</span>
      </span>
    </Link>
  );
}

export function CoachChat({ initial, prefill, available }: { initial: CoachMessage[]; prefill: string; available: boolean }) {
  const [messages, setMessages] = useState<CoachMessage[]>(initial);
  const [draft, setDraft] = useState(prefill);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"thinking" | "working" | null>(null);
  const [focused, setFocused] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  const toast = useToast();

  const scrollToEnd = useCallback((behavior: ScrollBehavior = "smooth") => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior });
  }, []);

  useEffect(() => {
    scrollToEnd("auto");
    const t = setTimeout(() => scrollToEnd("auto"), 300);
    return () => clearTimeout(t);
  }, [scrollToEnd]);

  useEffect(() => {
    if (!prefill || !textarea.current) return;
    const el = textarea.current;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [prefill]);

  async function ask(question: string) {
    const body = question.trim();
    if (!body || busy) return;
    if (!available) {
      toast("Baddy is nog niet gekoppeld.", "error");
      return;
    }
    const now = new Date().toISOString();
    const userMsg: CoachMessage = { id: `u-${Date.now()}`, role: "user", body, refs: [], created_at: now };
    const liveId = `a-${Date.now()}`;
    setMessages((m) => [...m, userMsg, { id: liveId, role: "assistant", body: "", refs: [], created_at: now, streaming: true }]);
    setDraft("");
    if (textarea.current) textarea.current.style.height = "auto";
    setBusy(true);
    setStatus("thinking");
    setTimeout(() => scrollToEnd(), 30);

    const patch = (fn: (m: CoachMessage) => CoachMessage) => setMessages((list) => list.map((m) => (m.id === liveId ? fn(m) : m)));
    let gotRefs = false;
    try {
      const res = await fetch("/api/coach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: body }) });
      if (!res.ok || !res.body) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? "Baddy is even niet bereikbaar.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const e = JSON.parse(line) as CoachEvent;
          if (e.type === "status") setStatus(e.status);
          else if (e.type === "text") {
            setStatus(null);
            patch((m) => ({ ...m, body: m.body + e.delta }));
          } else if (e.type === "ref") {
            gotRefs = true;
            patch((m) => ({ ...m, refs: [...m.refs, e.ref] }));
          } else if (e.type === "done") patch((m) => ({ ...m, id: e.id ?? m.id, streaming: false }));
          else if (e.type === "error") throw new Error(e.message);
        }
        scrollToEnd("auto");
      }
      patch((m) => ({ ...m, streaming: false }));
      if (gotRefs) router.refresh();
    } catch (err) {
      setMessages((list) => list.filter((m) => m.id !== liveId || m.body.length > 0).map((m) => (m.id === liveId ? { ...m, streaming: false } : m)));
      toast(err instanceof Error ? err.message : "Er ging iets mis.", "error");
      setDraft((d) => d || body);
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  async function clear() {
    if (!window.confirm("Wil je je gesprek met Baddy wissen? Recepten en schema's blijven staan.")) return;
    const r = await clearCoachConversation();
    if (!r.ok) toast(r.error, "error");
    else setMessages([]);
  }

  return (
    <div className="mx-auto w-full max-w-lg px-5 pt-0.5">
      <div className="mb-4 flex items-center gap-3">
        <Avatar name="Baddy" src={BADDY_AVATAR} size="lg" className="h-14 w-14" />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[27px] leading-tight">Baddy</h1>
          <p className="text-[12.5px] leading-snug text-muted">Coach van de squad. Kent de zeven principes en jouw cijfers.</p>
        </div>
        {messages.length > 0 ? (
          <button type="button" onClick={clear} disabled={busy} aria-label="Gesprek wissen" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-ink shadow-sm hover:bg-blush disabled:opacity-50">
            <RotateCcw className="h-[17px] w-[17px]" strokeWidth={1.6} />
          </button>
        ) : null}
      </div>

      {!available ? (
        <p className="soft mb-4 rounded-[16px] px-4 py-3 text-[13px] leading-snug">Baddy is nog niet gekoppeld. Zodra de beheerder een Anthropic API-sleutel heeft ingesteld, kun je hier vragen stellen.</p>
      ) : null}

      <div className="space-y-3 pb-[88px]" aria-live="polite">
        {messages.length === 0 ? (
          <div className="space-y-2 pt-2">
            <p className="px-1 text-[12.5px] text-muted">Begin met een vraag, of kies er een:</p>
            {STARTERS.map((s) => (
              <button key={s} type="button" disabled={busy || !available} onClick={() => ask(s)} className="glass block w-full rounded-[16px] px-4 py-3 text-left text-[14px] text-text hover:bg-blush/40 disabled:opacity-60">
                {s}
              </button>
            ))}
          </div>
        ) : null}

        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <p className="espresso max-w-[82%] whitespace-pre-wrap break-words rounded-[18px] rounded-br-[6px] px-3.5 py-2 text-[14px] leading-snug shadow-none">{m.body}</p>
            </div>
          ) : (
            <div key={m.id} className="flex items-start gap-2">
              <Avatar name="Baddy" src={BADDY_AVATAR} size="xs" className="mt-0.5" />
              <div className="min-w-0 max-w-[86%] space-y-2">
                {m.body || m.streaming ? (
                  <div className="glass rounded-[18px] rounded-tl-[6px] px-3.5 py-2.5 text-[14px] leading-relaxed text-text">
                    {m.body ? (
                      <RichText text={m.body} />
                    ) : (
                      <span className="flex items-center gap-2 text-[13px] text-muted">
                        <span className="flex gap-1" aria-hidden>
                          {[0, 1, 2].map((i) => (
                            <span key={i} className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted" style={{ animationDelay: `${i * 160}ms` }} />
                          ))}
                        </span>
                        {status === "working" ? "Baddy zet het in de app" : "Baddy denkt na"}
                      </span>
                    )}
                  </div>
                ) : null}
                {m.refs.map((r) => (
                  <RefCard key={`${r.type}-${r.id}`} refItem={r} />
                ))}
              </div>
            </div>
          ),
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(draft);
        }}
        className="fixed inset-x-0 z-30 flex justify-center px-4 transition-[bottom] duration-200"
        style={{ bottom: focused ? "calc(var(--sab) + 10px)" : "calc(var(--nav-h) + var(--sab) + 16px)" }}
      >
        <div className="glass flex w-full max-w-lg items-end gap-1.5 rounded-[24px] p-1.5 pl-4 shadow-[0_14px_30px_-18px_rgba(95,53,41,0.5)]">
          <textarea
            ref={textarea}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              e.currentTarget.style.height = "auto";
              e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 128)}px`;
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void ask(draft);
              }
            }}
            rows={1}
            maxLength={4000}
            disabled={!available}
            placeholder="Vraag Baddy iets"
            aria-label="Vraag aan Baddy"
            className="max-h-32 min-h-[40px] flex-1 resize-none bg-transparent py-2.5 text-[14px] text-text outline-none placeholder:text-muted disabled:opacity-60"
          />
          <button type="submit" disabled={!draft.trim() || busy || !available} aria-label="Versturen" className="espresso flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-none disabled:opacity-40">
            <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2} />
          </button>
        </div>
      </form>
    </div>
  );
}
