"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUp, ChefHat, FileText, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CHAT_PAGE_SIZE, attachmentHref, attachmentLabel, formatTime, groupMessages, type ChatMessage } from "@/lib/chat";
import type { DateKey } from "@/lib/dates";
import { deleteMessage, loadOlderMessages, markChatRead, sendMessage, type MessageAttachment } from "@/app/actions/chat";
import { ChatAttach, type PostOption, type RecipeOption } from "./chat-attach";
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
  recipes: RecipeOption[];
  posts: PostOption[];
  /** Signed URLs for uploaded attachments in the initial messages, keyed by object path. */
  signed: Record<string, string>;
}

function mergeById(list: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const seen = new Set(list.map((m) => m.id));
  return [...list, ...incoming.filter((m) => !seen.has(m.id))];
}

/** Group chat for the squad: optimistic sending, live updates, own-message delete, older-message paging. */
export function SquadChat({ initial, hasMore: initialHasMore, members, me, challengeId, today, tz, recipes, posts, signed: initialSigned }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [draft, setDraft] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [signed, setSigned] = useState<Record<string, string>>(initialSigned);
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
    const timers = [350, 900, 1800].map((ms) => setTimeout(() => scrollToEnd("auto"), ms));
    void markChatRead();
    return () => timers.forEach(clearTimeout);
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

  // Uploaded attachments that arrived live or by paging still need a signed URL.
  useEffect(() => {
    const missing = messages.filter((m) => (m.attachment_type === "image" || m.attachment_type === "file") && m.attachment_path && !signed[m.attachment_path]);
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const paths = [...new Set(missing.map((m) => m.attachment_path as string))];
        const { data } = await supabase.storage.from("chat").createSignedUrls(paths, 3600);
        if (cancelled || !data) return;
        const next: Record<string, string> = {};
        for (const item of data) if (item.path && item.signedUrl) next[item.path] = item.signedUrl;
        if (Object.keys(next).length) setSigned((s) => ({ ...s, ...next }));
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [messages, signed]);

  function send(body: string, attachment?: MessageAttachment) {
    const temp: ChatMessage = {
      id: `temp-${Date.now()}`,
      user_id: me,
      body,
      created_at: new Date().toISOString(),
      pending: true,
      attachment_type: attachment?.type ?? null,
      attachment_path: attachment && "path" in attachment ? attachment.path : null,
      attachment_name:
        attachment?.type === "file" ? attachment.name : attachment?.type === "recipe" ? (recipes.find((r) => r.id === attachment.refId)?.title ?? null) : attachment?.type === "post" ? (posts.find((p) => p.id === attachment.refId)?.caption ?? null) : null,
      ref_id: attachment && "refId" in attachment ? attachment.refId : null,
    };
    setMessages((list) => [...list, temp]);
    setDraft("");
    if (textarea.current) textarea.current.style.height = "auto";
    setTimeout(() => scrollToEnd(), 30);
    startSend(async () => {
      const r = await sendMessage({ body, attachment });
      if (!r.ok) {
        setMessages((list) => list.filter((m) => m.id !== temp.id));
        if (!attachment) setDraft(body);
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

  function submit() {
    const body = draft.trim();
    if (!body || sending) return;
    send(body);
  }

  function attach(attachment: MessageAttachment, previewUrl?: string) {
    if (previewUrl && "path" in attachment) setSigned((s) => ({ ...s, [attachment.path]: previewUrl }));
    send(draft.trim(), attachment);
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
                      {run.messages.map((m, i) => {
                        const lastInRun = i === run.messages.length - 1;
                        const href = attachmentHref(m);
                        const url = m.attachment_path ? signed[m.attachment_path] : undefined;
                        const thumb = m.attachment_type === "recipe" ? recipes.find((r) => r.id === m.ref_id)?.image : m.attachment_type === "post" ? posts.find((p) => p.id === m.ref_id)?.image : undefined;
                        return (
                          <div key={m.id} className={cn("flex w-full items-end gap-1.5", mine ? "justify-end" : "justify-start")}>
                            {mine && !m.pending ? (
                              <button
                                type="button"
                                onClick={() => setSelected(selected === m.id ? null : m.id)}
                                aria-label="Bericht verwijderen"
                                className="mb-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted/60 hover:text-danger"
                              >
                                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.7} />
                              </button>
                            ) : null}
                            <div className={cn("flex max-w-full flex-col", mine ? "items-end" : "items-start")}>
                              <div
                                className={cn(
                                  "w-fit max-w-full overflow-hidden text-[14px] leading-snug",
                                  mine ? "espresso rounded-[18px] rounded-br-[6px] shadow-none" : "glass rounded-[18px] rounded-bl-[6px] text-text",
                                  !lastInRun && (mine ? "rounded-br-[18px]" : "rounded-bl-[18px]"),
                                  m.attachment_type ? "p-1.5" : "px-3.5 py-2",
                                  m.pending && "opacity-60",
                                )}
                              >
                                {m.attachment_type === "image" ? (
                                  url ? (
                                    <a href={url} target="_blank" rel="noreferrer" className="relative block h-56 w-56 max-w-full overflow-hidden rounded-[13px] bg-blush">
                                      <Image src={url} alt="Foto" fill className="object-cover" unoptimized />
                                    </a>
                                  ) : (
                                    <div className="h-56 w-56 max-w-full animate-pulse rounded-[13px] bg-blush/70" aria-label="Foto laadt" />
                                  )
                                ) : null}
                                {m.attachment_type === "file" ? (
                                  <a href={url ?? "#"} target="_blank" rel="noreferrer" className={cn("flex items-center gap-2.5 rounded-[13px] px-3 py-2.5", mine ? "bg-white/10" : "bg-blush/60")}>
                                    <FileText className="h-5 w-5 shrink-0" strokeWidth={1.6} />
                                    <span className="min-w-0 truncate text-[13.5px] font-medium">{m.attachment_name ?? "Bestand"}</span>
                                  </a>
                                ) : null}
                                {(m.attachment_type === "recipe" || m.attachment_type === "post") && href ? (
                                  <Link href={href} className={cn("flex items-center gap-2.5 rounded-[13px] p-1.5 pr-3", mine ? "bg-white/10" : "bg-blush/60")}>
                                    <span className={cn("relative h-12 w-12 shrink-0 overflow-hidden rounded-[10px]", mine ? "bg-white/15" : "bg-blush")}>
                                      {thumb ? <Image src={thumb} alt="" fill className="object-cover" unoptimized /> : <ChefHat className="m-auto h-5 w-5" strokeWidth={1.5} />}
                                    </span>
                                    <span className="min-w-0">
                                      <span className={cn("block text-[10.5px] font-medium uppercase tracking-[0.14em]", mine ? "text-paper/70" : "text-muted")}>{m.attachment_type === "recipe" ? "Recept" : "Wall"}</span>
                                      <span className="block truncate text-[13.5px] font-medium">{m.attachment_name || (m.attachment_type === "recipe" ? "Bekijk recept" : "Bekijk foto")}</span>
                                    </span>
                                  </Link>
                                ) : null}
                                {m.body ? <p className={cn("whitespace-pre-wrap break-words", m.attachment_type && "px-2 pb-1 pt-1.5")}>{m.body}</p> : null}
                                {m.attachment_type && !m.body ? <span className="sr-only">{attachmentLabel(m)}</span> : null}
                              </div>
                              {selected === m.id ? (
                                <button type="button" onClick={() => remove(m.id)} className="mt-1 flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[12px] font-medium text-danger shadow-sm">
                                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.7} /> Verwijderen
                                </button>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
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
        <div className="glass flex w-full max-w-lg items-end gap-1.5 rounded-[24px] p-1.5 shadow-[0_14px_30px_-18px_rgba(95,53,41,0.5)]">
          <button type="button" onClick={() => setAttachOpen(true)} aria-label="Toevoegen" className="soft flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink">
            <Plus className="h-[18px] w-[18px]" strokeWidth={1.9} />
          </button>
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
            className="max-h-32 min-h-[40px] flex-1 resize-none bg-transparent py-2.5 pl-1 text-[14px] text-text outline-none placeholder:text-muted"
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

      <ChatAttach
        open={attachOpen}
        onClose={() => setAttachOpen(false)}
        challengeId={challengeId}
        me={me}
        members={members}
        recipes={recipes}
        posts={posts}
        onAttach={attach}
        onError={(msg) => toast(msg, "error")}
      />
    </>
  );
}
