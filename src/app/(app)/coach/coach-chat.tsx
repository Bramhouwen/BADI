"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowUp, Bookmark, Brain, ChefHat, Dumbbell, RotateCcw, ThumbsDown, ThumbsUp } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { RichText } from "@/components/coach/rich-text";
import { clearCoachConversation, rateCoachMessage } from "@/app/actions/coach";
import type { StoredRef } from "@/lib/coach/prompt";
import { cn } from "@/lib/utils";

export interface CoachMessage {
  id: string;
  role: "user" | "assistant";
  body: string;
  refs: StoredRef[];
  created_at: string;
  feedback?: 1 | -1 | null;
  streaming?: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type CoachEvent =
  | { type: "status"; status: "thinking" | "working" }
  | { type: "text"; delta: string }
  | { type: "ref"; ref: StoredRef }
  | { type: "done"; id: string | null }
  | { type: "error"; message: string };

export const BADDY_AVATAR = "/brand/baddy.jpg";

const STARTERS = [
  "Maak drie ontbijtjes zonder toegevoegde suikers",
  "Maak een krachtschema voor 3 keer per week",
  "Hoe haal ik makkelijker 3 liter water?",
  "Wat eet ik na een avondtraining?",
  "Ik slaap slecht, waar begin ik?",
];

function RefCard({ refItem }: { refItem: StoredRef }) {
  if (refItem.type === "memory") {
    return (
      <Link href="/profile#baddy-geheugen" className="flex items-center gap-2 px-1 text-[12px] text-muted hover:text-ink">
        <Bookmark className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
        <span className="min-w-0 truncate">Onthouden: {refItem.name}</span>
      </Link>
    );
  }
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

export function CoachChat({ initial, prefill, autoSend = false, available }: { initial: CoachMessage[]; prefill: string; autoSend?: boolean; available: boolean }) {
  const [messages, setMessages] = useState<CoachMessage[]>(initial);
  const [draft, setDraft] = useState(prefill);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"thinking" | "working" | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const autoSent = useRef(false);
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

  // A question from the Home bar or the bubble is sent once, and the query is removed so a refresh does not resend it.
  useEffect(() => {
    if (!autoSend || autoSent.current) return;
    autoSent.current = true;
    // A refresh keeps ?send=1 in some browsers; remember what was sent so it is never sent twice.
    const key = "badi:coach-autosent";
    let already = false;
    try {
      already = sessionStorage.getItem(key) === prefill;
      sessionStorage.setItem(key, prefill);
    } catch {}
    // Clean the URL once the router has settled, without a navigation.
    setTimeout(() => window.history.replaceState(null, "", "/coach"), 600);
    // Already sent in this session: leave it ready in the field instead of sending it twice.
    if (already) return;
    setTimeout(() => void ask(prefill), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSend]);

  async function rate(id: string, value: 1 | -1) {
    const current = messages.find((m) => m.id === id)?.feedback ?? null;
    const next = current === value ? null : value;
    setMessages((list) => list.map((m) => (m.id === id ? { ...m, feedback: next } : m)));
    const r = await rateCoachMessage(id, next);
    if (!r.ok) {
      setMessages((list) => list.map((m) => (m.id === id ? { ...m, feedback: current } : m)));
      toast(r.error, "error");
    }
  }

  async function clear() {
    if (!window.confirm("Wil je je gesprek met Baddy wissen? Recepten en schema's blijven staan.")) return;
    const r = await clearCoachConversation();
    if (!r.ok) toast(r.error, "error");
    else setMessages([]);
  }

  return (
    <div className="chat-thread mx-auto w-full max-w-3xl px-4" style={{ paddingTop: "calc(var(--sat) + 78px)" }}>
      {/* Full-screen header, like the squad chats: the app header and tab bar are hidden here. */}
      <header className="fixed inset-x-0 top-0 z-30 border-b border-ink/[0.06] bg-[#f6ece4]/92 backdrop-blur-md" style={{ paddingTop: "var(--sat)" }}>
        <div className="mx-auto flex h-[62px] max-w-3xl items-center gap-2.5 px-3">
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? router.back() : router.push("/squad"))}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink hover:bg-blush"
            aria-label="Terug"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={1.7} />
          </button>
          <Avatar name="Baddy" src={BADDY_AVATAR} size="sm" className="h-10 w-10 ring-2 ring-sage/50" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-sans text-[15.5px] font-semibold leading-tight text-text">Baddy de Coach</h1>
            <p className="truncate text-[12px] leading-tight text-muted">Kent de zeven principes en jouw cijfers</p>
          </div>
          <Link href="/profile#baddy-geheugen" aria-label="Wat Baddy over mij weet" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink hover:bg-blush">
            <Brain className="h-[18px] w-[18px]" strokeWidth={1.6} />
          </Link>
          {messages.length > 0 ? (
            <button type="button" onClick={clear} disabled={busy} aria-label="Gesprek wissen" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink hover:bg-blush disabled:opacity-50">
              <RotateCcw className="h-[18px] w-[18px]" strokeWidth={1.6} />
            </button>
          ) : null}
        </div>
      </header>

      {!available ? (
        <p className="soft mb-4 rounded-[16px] px-4 py-3 text-[13px] leading-snug">Baddy is nog niet gekoppeld. Zodra de beheerder een Anthropic API-sleutel heeft ingesteld, kun je hier vragen stellen.</p>
      ) : null}

      <div className="space-y-3" style={{ paddingBottom: "calc(var(--sab) + 92px)" }} aria-live="polite">
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
                {!m.streaming && m.body && UUID.test(m.id) ? (
                  <div className="flex items-center gap-1 px-1" role="group" aria-label="Was dit nuttig?">
                    <button
                      type="button"
                      onClick={() => rate(m.id, 1)}
                      aria-pressed={m.feedback === 1}
                      aria-label="Nuttig"
                      className={cn("flex h-7 w-7 items-center justify-center rounded-full", m.feedback === 1 ? "bg-sage/25 text-ink" : "text-muted/70 hover:text-ink")}
                    >
                      <ThumbsUp className="h-3.5 w-3.5" strokeWidth={1.8} />
                    </button>
                    <button
                      type="button"
                      onClick={() => rate(m.id, -1)}
                      aria-pressed={m.feedback === -1}
                      aria-label="Niet nuttig"
                      className={cn("flex h-7 w-7 items-center justify-center rounded-full", m.feedback === -1 ? "bg-blush text-ink" : "text-muted/70 hover:text-ink")}
                    >
                      <ThumbsDown className="h-3.5 w-3.5" strokeWidth={1.8} />
                    </button>
                  </div>
                ) : null}
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
        className="fixed inset-x-0 bottom-0 z-30 flex justify-center bg-gradient-to-t from-[#f6ece4] via-[#f6ece4]/95 to-transparent px-3 pt-3"
        style={{ paddingBottom: "calc(var(--sab) + 8px)" }}
      >
        <div className="flex w-full max-w-3xl items-end gap-1.5 rounded-[24px] bg-white p-1.5 pl-4 shadow-[0_6px_18px_-12px_rgba(95,53,41,0.45)] ring-1 ring-ink/[0.05]">
          <textarea
            ref={textarea}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              e.currentTarget.style.height = "auto";
              e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 128)}px`;
            }}
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
