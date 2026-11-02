"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ArrowUp, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CHAT_PAGE_SIZE, formatTime, groupMessages, type ChatMessage } from "@/lib/chat";
import type { DateKey } from "@/lib/dates";
import { deleteMessage, loadOlderMessages, markChatRead, sendMessage } from "@/app/actions/chat";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export interface ChatMember {
  name: string;
  avatar: string | null;
}

interface Props {
  initial: ChatMessage[];
  hasMore: boolean;
  members: Record<string, ChatMember>;
  me: string;
  challengeId: string;
  today: DateKey;
  tz: string;
}

function mergeById(list: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const seen = new Set(list.map((m) => m.id));
  return [...list, ...incoming.filter((m) => !seen.has(m.id))];
}

/** Group chat for the squad: optimistic sending, live updates, own-message delete, older-message paging. */
export function SquadChat({ initial, hasMore: initialHasMore, members, me, challengeId, today, tz }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [draft, setDraft] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [sending, startSend] = useTransition();
  const [loadingOlder, startOlder] = useTransition();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const toast = useToast();

  const scrollToEnd = useCallback((behavior: ScrollBehavior = "smooth") => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior });
  }, []);

  // Initial position: at the newest message, repeated once fonts and avatars have settled. Then mark the chat as read.
  useEffect(() => {
    scrollToEnd("auto");
    const t = setTimeout(() => scrollToEnd("auto"), 350);
    void markChatRead();
    return () => clearTimeout(t);
  }, [scrollToEnd]);

  // Live updates from the squad.
  useEffect(() => {
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      return;
    }
    const ch = supabase
      .channel(`squad-chat:${challengeId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "squad_messages", filter: `challenge_id=eq.${challengeId}` }, (payload) => {
        const row = payload.new as ChatMessage;
        if (!row?.id) return;
        setMessages((list) => mergeById(list, [row]));
        if (row.user_id !== me) void markChatRead();
        setTimeout(() => scrollToEnd(), 50);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "squad_messages" }, (payload) => {
        const id = (payload.old as { id?: string })?.id;
        if (id) setMessages((list) => list.filter((m) => m.id !== id));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [challengeId, me, scrollToEnd]);

  function submit() {
    const body = draft.trim();
    if (!body || sending) return;
    const temp: ChatMessage = { id: `temp-${Date.now()}`, user_id: me, body, created_at: new Date().toISOString(), pending: true };
    setMessages((list) => [...list, temp]);
    setDraft("");
    if (textarea.current) textarea.current.style.height = "auto";
    setTimeout(() => scrollToEnd(), 30);
    startSend(async () => {
      const r = await sendMessage({ body });
      if (!r.ok) {
        setMessages((list) => list.filter((m) => m.id !== temp.id));
        setDraft(body);
        toast(r.error, "error");
        return;
      }
      const saved = r.data!;
      setMessages((list) => {
        const withoutTemp = list.filter((m) => m.id !== temp.id);
        return withoutTemp.some((m) => m.id === saved.id) ? withoutTemp : [...withoutTemp, saved];
      });
    });
  }

  function remove(id: string) {
    const backup = messages;
    setMessages((list) => list.filter((m) => m.id !== id));
    setSelected(null);
    void deleteMessage(id).then((r) => {
      if (!r.ok) {
        setMessages(backup);
        toast(r.error, "error");
      }
    });
  }

  function older() {
    if (!messages.length || loadingOlder) return;
    const before = messages[0].created_at;
    startOlder(async () => {
      const r = await loadOlderMessages(before);
      if (!r.ok) return;
      const rows = [...r.data!].reverse();
      setMessages((list) => mergeById(rows, list));
      setHasMore(r.data!.length === CHAT_PAGE_SIZE);
    });
  }

  function onInput(e: React.FormEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget;
    setDraft(el.value);
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }

  const days = groupMessages(messages, today, tz);

  return (
    <>
      <div className="pb-[64px]" aria-live="polite">
        {hasMore ? (
          <button type="button" onClick={older} disabled={loadingOlder} className="soft mx-auto mb-4 block rounded-full px-4 py-1.5 text-[12px] font-medium text-ink disabled:opacity-60">
            {loadingOlder ? "Laden…" : "Eerdere berichten"}
          </button>
        ) : null}

        {days.length === 0 ? <p className="py-10 text-center text-[13px] text-muted">Nog geen berichten.</p> : null}

        {days.map((day) => (
          <section key={day.date} className="mb-4" aria-label={day.label}>
            <p className="mb-3 text-center text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{day.label}</p>
            <div className="space-y-3">
              {day.runs.map((run) => {
                const mine = run.user_id === me;
                const member = members[run.user_id];
                const last = run.messages[run.messages.length - 1];
                return (
                  <div key={run.key} className={cn("flex items-end gap-2", mine ? "justify-end" : "justify-start")}>
                    {!mine ? <Avatar name={member?.name ?? "?"} src={member?.avatar} size="xs" className="mb-4" /> : null}
                    <div className={cn("flex max-w-[78%] flex-col gap-1", mine ? "items-end" : "items-start")}>
                      {!mine ? <span className="px-1 text-[11px] font-medium text-muted">{member?.name ?? "Lid"}</span> : null}
                      {run.messages.map((m, i) => (
                        <div key={m.id} className="w-full">
                          <button
                            type="button"
                            onClick={() => (mine && !m.pending ? setSelected(selected === m.id ? null : m.id) : undefined)}
                            className={cn(
                              "block w-fit max-w-full whitespace-pre-wrap break-words px-3.5 py-2 text-left text-[14px] leading-snug",
                              mine ? "ml-auto espresso rounded-[18px] rounded-br-[6px] shadow-none" : "glass rounded-[18px] rounded-bl-[6px] text-text",
                              i === run.messages.length - 1 ? "" : mine ? "rounded-br-[18px]" : "rounded-bl-[18px]",
                              m.pending && "opacity-60",
                            )}
                          >
                            {m.body}
                          </button>
                          {selected === m.id ? (
                            <div className="mt-1 flex justify-end">
                              <button type="button" onClick={() => remove(m.id)} className="flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[12px] font-medium text-danger shadow-sm">
                                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.7} /> Verwijderen
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ))}
                      <span className="px-1 text-[10.5px] tabular-nums text-muted/80">{formatTime(last.created_at, tz)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="fixed inset-x-0 z-30 flex justify-center px-4 transition-[bottom] duration-200"
        style={{ bottom: focused ? "calc(var(--sab) + 10px)" : "calc(var(--nav-h) + var(--sab) + 16px)" }}
      >
        <div className="glass flex w-full max-w-lg items-end gap-2 rounded-[24px] p-1.5 pl-4 shadow-[0_14px_30px_-18px_rgba(95,53,41,0.5)]">
          <textarea
            ref={textarea}
            value={draft}
            onInput={onInput}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            maxLength={1000}
            placeholder="Bericht aan de squad"
            aria-label="Bericht"
            className="max-h-32 min-h-[40px] flex-1 resize-none bg-transparent py-2.5 text-[14px] text-text outline-none placeholder:text-muted"
          />
          <button
            type="submit"
            disabled={!draft.trim() || sending}
            aria-label="Versturen"
            className="espresso flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-none disabled:opacity-40"
          >
            <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2} />
          </button>
        </div>
      </form>
    </>
  );
}
