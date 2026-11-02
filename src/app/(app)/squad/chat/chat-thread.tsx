"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowUp, Check, CheckCheck, ChefHat, Clock3, Copy, FileText, Paperclip, Plus, Smile, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BADDY_ID, CHAT_PAGE_SIZE, asSender, attachmentHref, attachmentLabel, formatTime, groupMessages, type ChatMember, type ChatMessage } from "@/lib/chat";
import { QUICK_REACTIONS, SQUAD_KEY, dmKey, groupReactions, inConversation, readByPeer, typingLabel, type ReactionRow } from "@/lib/conversations";
import { mentionsBaddy } from "@/lib/coach/prompt";
import type { DateKey } from "@/lib/dates";
import { deleteMessage, loadNewerMessages, loadOlderMessages, markChatRead, sendMessage, toggleReaction, type MessageAttachment } from "@/app/actions/chat";
import { applyMention, mentionQuery, mentionSuggestions, splitMentions, type MentionMember } from "@/lib/mentions";
import { announceTyping, stopTyping, useIsOnline, useTyping } from "@/lib/presence";
import { Avatar } from "@/components/ui/avatar";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { EmojiPicker } from "@/components/chat/emoji-picker";
import { useToast } from "@/components/ui/toast";
import { ChatAttach, type PostOption, type RecipeOption } from "../chat-attach";
import { cn } from "@/lib/utils";

export interface ThreadPeer {
  id: string;
  name: string;
  avatar: string | null;
}

interface Props {
  /** The other member in a private chat; null for the squad group chat. */
  peer: ThreadPeer | null;
  initial: ChatMessage[];
  hasMore: boolean;
  reactions: ReactionRow[];
  peerLastRead: string | null;
  members: Record<string, ChatMember>;
  /** Squad member ids in squad order, for the group header and name colours. */
  memberOrder: string[];
  me: string;
  challengeId: string;
  today: DateKey;
  tz: string;
  recipes: RecipeOption[];
  posts: PostOption[];
  signed: Record<string, string>;
  mentionMembers: MentionMember[];
}

const NAME_COLORS = ["#b5654a", "#5f7d4e", "#4a6fa5", "#a0527d", "#b08423"];

function mergeById(list: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const seen = new Set(list.map((m) => m.id));
  return [...list, ...incoming.filter((m) => !seen.has(m.id))];
}

/** One conversation, group or private: live updates, reactions, read ticks, typing, emoji and attachments. */
export function ChatThread(props: Props) {
  const { peer, members, memberOrder, me, challengeId, today, tz, recipes, posts, mentionMembers } = props;
  const peerId = peer?.id ?? null;
  const group = peerId === null;
  const typingKey = group ? SQUAD_KEY : dmKey(peerId);

  const [messages, setMessages] = useState<ChatMessage[]>(props.initial);
  const [hasMore, setHasMore] = useState(props.hasMore);
  const [reactionRows, setReactionRows] = useState<ReactionRow[]>(props.reactions);
  const [peerLastRead, setPeerLastRead] = useState(props.peerLastRead);
  const [draft, setDraft] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [reactPickerFor, setReactPickerFor] = useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [baddySince, setBaddySince] = useState<string | null>(null);
  const [signed, setSigned] = useState<Record<string, string>>(props.signed);
  const [caret, setCaret] = useState(0);
  const mention = group ? mentionQuery(draft, caret) : null;
  const suggestions = mention ? mentionSuggestions(mentionMembers, mention.query, me).slice(0, 4) : [];
  const [sending, startSend] = useTransition();
  const [loadingOlder, startOlder] = useTransition();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const toast = useToast();

  const typingIds = useTyping(typingKey);
  const peerOnline = useIsOnline(peerId ?? undefined);
  const reactions = useMemo(() => groupReactions(reactionRows, me), [reactionRows, me]);
  const nameOf = useCallback((id: string) => members[id]?.name ?? "Lid", [members]);
  const colorOf = (id: string) => NAME_COLORS[Math.max(0, memberOrder.indexOf(id)) % NAME_COLORS.length];

  const scrollToEnd = useCallback((behavior: ScrollBehavior = "smooth") => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior });
  }, []);

  // Start at the newest message, again once images settle; then mark the conversation as read.
  useEffect(() => {
    scrollToEnd("auto");
    const timers = [350, 900, 1800].map((ms) => setTimeout(() => scrollToEnd("auto"), ms));
    void markChatRead(peerId);
    return () => timers.forEach(clearTimeout);
  }, [scrollToEnd, peerId]);

  // Live: new and deleted messages, reactions, and the other person's read state.
  useEffect(() => {
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      return;
    }
    const ch = supabase
      .channel(`chat:${challengeId}:${peerId ?? "squad"}:${me}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "squad_messages", filter: `challenge_id=eq.${challengeId}` }, (payload) => {
        const raw = payload.new as ChatMessage;
        if (!raw?.id || !inConversation(raw, me, peerId)) return;
        const row = asSender(raw);
        setMessages((list) => mergeById(list, [row]));
        stopTyping(typingKey, raw.user_id);
        if (row.user_id === BADDY_ID) setBaddySince(null);
        if (row.user_id !== me) void markChatRead(peerId);
        setTimeout(() => scrollToEnd(), 50);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "squad_messages" }, (payload) => {
        const id = (payload.old as { id?: string })?.id;
        if (id) setMessages((list) => list.filter((m) => m.id !== id));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "message_reactions" }, (payload) => {
        const r = payload.new as ReactionRow;
        if (!r?.message_id) return;
        setReactionRows((rows) => (rows.some((x) => x.message_id === r.message_id && x.user_id === r.user_id && x.emoji === r.emoji) ? rows : [...rows, r]));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "message_reactions" }, (payload) => {
        const r = payload.old as Partial<ReactionRow>;
        if (!r?.message_id) return;
        setReactionRows((rows) => rows.filter((x) => !(x.message_id === r.message_id && x.user_id === r.user_id && x.emoji === r.emoji)));
      });
    if (peerId) {
      ch.on("postgres_changes", { event: "*", schema: "public", table: "direct_reads", filter: `user_id=eq.${peerId}` }, (payload) => {
        const r = payload.new as { peer_id?: string; last_read_at?: string };
        if (r?.peer_id === me && r.last_read_at) setPeerLastRead(r.last_read_at);
      });
    }
    ch.subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [challengeId, me, peerId, typingKey, scrollToEnd]);

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

  // Fallback for Realtime: poll for Baddy's reply for up to 90 seconds.
  useEffect(() => {
    if (!baddySince) return;
    const started = Date.now();
    const id = setInterval(async () => {
      if (Date.now() - started > 90_000) {
        setBaddySince(null);
        return;
      }
      const r = await loadNewerMessages(baddySince, peerId);
      if (!r.ok || !r.data?.length) return;
      const rows = r.data.map(asSender);
      setMessages((list) => mergeById(list, rows));
      if (rows.some((m) => m.user_id === BADDY_ID)) {
        setBaddySince(null);
        setTimeout(() => scrollToEnd(), 50);
      }
    }, 3000);
    return () => clearInterval(id);
  }, [baddySince, scrollToEnd, peerId]);

  function send(body: string, attachment?: MessageAttachment) {
    const temp: ChatMessage = {
      id: `temp-${Date.now()}`,
      user_id: me,
      recipient_id: peerId,
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
    setEmojiOpen(false);
    if (textarea.current) textarea.current.style.height = "auto";
    setTimeout(() => scrollToEnd(), 30);
    startSend(async () => {
      const r = await sendMessage({ body, attachment, to: peerId });
      if (!r.ok) {
        setMessages((list) => list.filter((m) => m.id !== temp.id));
        if (!attachment) setDraft(body);
        toast(r.error, "error");
        return;
      }
      const saved = asSender(r.data!);
      if (group && body && mentionsBaddy(body)) setBaddySince(saved.created_at);
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

  function react(messageId: string, emoji: string) {
    const mine = reactionRows.some((r) => r.message_id === messageId && r.user_id === me && r.emoji === emoji);
    const before = reactionRows;
    setReactionRows((rows) => (mine ? rows.filter((r) => !(r.message_id === messageId && r.user_id === me && r.emoji === emoji)) : [...rows, { message_id: messageId, user_id: me, emoji }]));
    setSelected(null);
    setReactPickerFor(null);
    void toggleReaction({ messageId, emoji, on: !mine }).then((r) => {
      if (!r.ok) {
        setReactionRows(before);
        toast(r.error, "error");
      }
    });
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast("Gekopieerd", "success");
    } catch {
      toast("Kopiëren lukt niet op dit apparaat.", "error");
    }
    setSelected(null);
  }

  function older() {
    if (!messages.length || loadingOlder) return;
    const before = messages[0].created_at;
    startOlder(async () => {
      const r = await loadOlderMessages(before, peerId);
      if (!r.ok) return;
      const rows = [...r.data!.messages].reverse().map(asSender);
      setMessages((list) => mergeById(rows, list));
      setReactionRows((list) => [...list, ...r.data!.reactions]);
      setHasMore(r.data!.messages.length === CHAT_PAGE_SIZE);
    });
  }

  function pickMention(m: MentionMember) {
    if (!mention) return;
    const next = applyMention(draft, caret, mention.start, m.label);
    setDraft(next.text);
    setCaret(next.caret);
    requestAnimationFrame(() => {
      const el = textarea.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(next.caret, next.caret);
    });
  }

  function insertEmoji(e: string) {
    const el = textarea.current;
    const at = el?.selectionStart ?? draft.length;
    const next = draft.slice(0, at) + e + draft.slice(el?.selectionEnd ?? at);
    setDraft(next);
    requestAnimationFrame(() => {
      if (!el) return;
      el.setSelectionRange(at + e.length, at + e.length);
    });
  }

  function onInput(e: React.FormEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget;
    setDraft(el.value);
    setCaret(el.selectionStart ?? el.value.length);
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
    if (el.value.trim()) announceTyping(peerId ?? "squad");
  }

  const days = groupMessages(messages, today, tz);
  const typingNames = typingIds.filter((id) => id !== me).map((id) => nameOf(id));
  const typingText = typingLabel(typingNames);
  const subtitle = typingText ?? (group ? memberOrder.map((id) => (id === me ? "jij" : nameOf(id))).join(", ") : peerOnline ? "online" : null);

  return (
    <>
      {/* Header */}
      <header className="fixed inset-x-0 top-0 z-30 border-b border-ink/[0.06] bg-[#f6ece4]/92 backdrop-blur-md md:left-[320px]" style={{ paddingTop: "var(--sat)" }}>
        <div className="mx-auto flex h-[62px] max-w-3xl items-center gap-2.5 px-3">
          <Link href="/squad" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink hover:bg-blush md:hidden" aria-label="Terug naar chats">
            <ArrowLeft className="h-5 w-5" strokeWidth={1.7} />
          </Link>
          {group ? (
            <div className="flex shrink-0 -space-x-3" aria-hidden>
              {[...memberOrder.filter((id) => id !== me), me].slice(0, 3).map((id) => (
                <Avatar key={id} name={nameOf(id)} src={members[id]?.avatar} size="sm" className="h-9 w-9 text-[11px] ring-2 ring-[#f6ece4]" />
              ))}
            </div>
          ) : (
            <Link href={`/squad/${peerId}`} aria-label={`Profiel van ${peer!.name}`}>
              <MemberAvatar userId={peerId!} name={peer!.name} src={peer!.avatar} size={36} />
            </Link>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15.5px] font-semibold leading-tight text-text">{group ? "The Squad" : peer!.name}</p>
            {subtitle ? <p className={cn("truncate text-[12px] leading-tight", typingText ? "font-medium text-sage" : "text-muted")}>{subtitle}</p> : null}
          </div>
        </div>
      </header>

      {/* Messages */}
      <div
        className="chat-thread mx-auto max-w-3xl px-3"
        style={{ paddingTop: "calc(var(--sat) + 74px)", paddingBottom: emojiOpen ? "calc(var(--sab) + 300px)" : "calc(var(--sab) + 84px)" }}
        aria-live="polite"
        onClick={(e) => {
          if (e.target === e.currentTarget) setSelected(null);
        }}
      >
        {hasMore ? (
          <button type="button" onClick={older} disabled={loadingOlder} className="mx-auto mb-4 block rounded-full bg-white/80 px-4 py-1.5 text-[12px] font-medium text-ink shadow-sm disabled:opacity-60">
            {loadingOlder ? "Laden…" : "Eerdere berichten"}
          </button>
        ) : null}

        {days.length === 0 ? (
          <div className="mx-auto mt-10 max-w-xs rounded-[18px] bg-white/70 px-4 py-3 text-center text-[13px] text-muted">
            {group ? "Nog geen berichten in de groep." : `Stuur ${peer!.name} een eerste bericht. Alleen jullie tweeën zien dit gesprek.`}
          </div>
        ) : null}

        {days.map((day) => (
          <section key={day.date} className="mb-3" aria-label={day.label}>
            <div className="sticky z-10 mb-3 flex justify-center" style={{ top: "calc(var(--sat) + 70px)" }}>
              <span className="rounded-full bg-white/90 px-3 py-1 text-[11.5px] font-medium text-ink/70 shadow-sm">{day.label}</span>
            </div>
            <div className="space-y-2">
              {day.runs.map((run) => {
                const mine = run.user_id === me;
                const member = members[run.user_id];
                return (
                  <div key={run.key} className={cn("flex items-end gap-1.5", mine ? "justify-end" : "justify-start")}>
                    {group && !mine ? <Avatar name={member?.name ?? "?"} src={member?.avatar} size="xs" className="mb-0.5 h-7 w-7" /> : null}
                    <div className={cn("flex max-w-[80%] flex-col gap-[3px]", mine ? "items-end" : "items-start")}>
                      {run.messages.map((m, i) => {
                        const first = i === 0;
                        const href = attachmentHref(m);
                        const url = m.attachment_path ? signed[m.attachment_path] : undefined;
                        const thumb = m.attachment_type === "recipe" ? recipes.find((r) => r.id === m.ref_id)?.image : m.attachment_type === "post" ? posts.find((p) => p.id === m.ref_id)?.image : undefined;
                        const msgReactions = reactions[m.id] ?? [];
                        const read = !group && mine && readByPeer(m, peerLastRead);
                        const meta = (
                          <span className={cn("float-right ml-2 mt-1.5 flex translate-y-[3px] items-center gap-0.5 text-[10.5px] tabular-nums leading-none", mine ? "text-paper/65" : "text-muted")}>
                            {formatTime(m.created_at, tz)}
                            {mine && !group ? (
                              m.pending ? <Clock3 className="h-3 w-3" strokeWidth={2} aria-label="Wordt verstuurd" /> : read ? <CheckCheck className="h-3.5 w-3.5 text-[#9fd3a8]" strokeWidth={2.2} aria-label="Gelezen" /> : <Check className="h-3.5 w-3.5" strokeWidth={2.2} aria-label="Verstuurd" />
                            ) : mine && m.pending ? (
                              <Clock3 className="h-3 w-3" strokeWidth={2} aria-label="Wordt verstuurd" />
                            ) : null}
                          </span>
                        );
                        return (
                          <div key={m.id} className={cn("flex max-w-full flex-col", mine ? "items-end" : "items-start", msgReactions.length > 0 && "mb-4")}>
                            <div className="relative max-w-full">
                              <button
                                type="button"
                                onClick={() => {
                                  if (m.pending) return;
                                  setReactPickerFor(null);
                                  setSelected(selected === m.id ? null : m.id);
                                }}
                                className={cn(
                                  "block w-fit max-w-full overflow-hidden text-left text-[14.5px] leading-snug shadow-[0_1px_1.5px_rgba(95,53,41,0.12)] transition",
                                  mine ? "bg-[#5f3529] text-paper" : "bg-white text-text",
                                  "rounded-[16px]",
                                  first && (mine ? "rounded-tr-[5px]" : "rounded-tl-[5px]"),
                                  m.attachment_type ? "p-1" : "px-3 py-[7px]",
                                  m.pending && "opacity-70",
                                  selected === m.id && "ring-2 ring-sage",
                                )}
                                aria-label={m.body || attachmentLabel(m) || "Bericht"}
                              >
                                {/* Buttons inherit font and colour (globals.css), so the bubble content sets its own. */}
                                <span className={cn("block", mine ? "text-paper" : "text-text")}>
                                {group && !mine && first ? (
                                  <span className={cn("block text-[12.5px] font-semibold", m.attachment_type && "px-2 pt-1")} style={{ color: run.user_id === BADDY_ID ? "#8c9e7a" : colorOf(run.user_id) }}>
                                    {run.user_id === BADDY_ID ? "Baddy de Coach" : member?.name ?? "Lid"}
                                  </span>
                                ) : null}
                                {m.attachment_type === "image" ? (
                                  url ? (
                                    <span className="relative block h-60 w-60 max-w-full overflow-hidden rounded-[12px] bg-blush">
                                      <Image src={url} alt="Foto" fill className="object-cover" unoptimized />
                                    </span>
                                  ) : (
                                    <span className="block h-60 w-60 max-w-full animate-pulse rounded-[12px] bg-blush/70" aria-label="Foto laadt" />
                                  )
                                ) : null}
                                {m.attachment_type === "file" ? (
                                  <span className={cn("flex items-center gap-2.5 rounded-[12px] px-3 py-2.5", mine ? "bg-white/10" : "bg-blush/60")}>
                                    <FileText className="h-5 w-5 shrink-0" strokeWidth={1.6} />
                                    <span className="min-w-0 truncate text-[13.5px] font-medium">{m.attachment_name ?? "Bestand"}</span>
                                  </span>
                                ) : null}
                                {(m.attachment_type === "recipe" || m.attachment_type === "post") && href ? (
                                  <span className={cn("flex items-center gap-2.5 rounded-[12px] p-1.5 pr-3", mine ? "bg-white/10" : "bg-blush/60")}>
                                    <span className={cn("relative h-12 w-12 shrink-0 overflow-hidden rounded-[10px]", mine ? "bg-white/15" : "bg-blush")}>
                                      {thumb ? <Image src={thumb} alt="" fill className="object-cover" unoptimized /> : <ChefHat className="m-auto mt-3.5 h-5 w-5" strokeWidth={1.5} />}
                                    </span>
                                    <span className="min-w-0">
                                      <span className={cn("block text-[10.5px] font-medium uppercase tracking-[0.14em]", mine ? "text-paper/70" : "text-muted")}>{m.attachment_type === "recipe" ? "Recept" : "Wall"}</span>
                                      <span className="block truncate text-[13.5px] font-medium">{m.attachment_name || (m.attachment_type === "recipe" ? "Bekijk recept" : "Bekijk foto")}</span>
                                    </span>
                                  </span>
                                ) : null}
                                {m.body ? (
                                  <span className={cn("block whitespace-pre-wrap break-words text-[14.5px] leading-[1.38]", m.attachment_type && "px-2 pb-1 pt-1.5")}>
                                    {splitMentions(m.body, mentionMembers).map((t, ti) =>
                                      t.member ? (
                                        <span key={ti} className={cn("rounded-md px-1 font-semibold", mine ? "bg-white/15" : "bg-sage/20 text-ink", t.member.id === me && "ring-1 ring-sage")}>
                                          {t.text}
                                        </span>
                                      ) : (
                                        <span key={ti}>{t.text}</span>
                                      ),
                                    )}
                                    {meta}
                                  </span>
                                ) : (
                                  <span className="block px-2 pb-0.5">{meta}</span>
                                )}
                                </span>
                              </button>

                              {msgReactions.length > 0 ? (
                                <span className={cn("absolute -bottom-[19px] flex gap-0.5", mine ? "right-2" : "left-2")}>
                                  {msgReactions.map((r) => (
                                    <button
                                      key={r.emoji}
                                      type="button"
                                      onClick={() => react(m.id, r.emoji)}
                                      aria-label={`${r.emoji} van ${r.users.map((u) => (u === me ? "jou" : nameOf(u))).join(", ")}`}
                                      aria-pressed={r.mine}
                                      className={cn("flex h-6 items-center gap-0.5 rounded-full bg-white px-1.5 text-[12px] shadow-sm ring-1", r.mine ? "ring-sage" : "ring-ink/[0.08]")}
                                    >
                                      <span className="text-[13px] leading-none">{r.emoji}</span>
                                      {r.count > 1 ? <span className="text-[11px] font-medium tabular-nums text-ink/70">{r.count}</span> : null}
                                    </button>
                                  ))}
                                </span>
                              ) : null}
                            </div>

                            {selected === m.id ? (
                              <div className={cn("relative z-20 mt-2 flex flex-col gap-1.5", mine ? "items-end" : "items-start", msgReactions.length > 0 && "mt-5")}>
                                <div className="flex items-center gap-0.5 rounded-full bg-white px-1.5 py-1 shadow-[0_10px_24px_-12px_rgba(95,53,41,0.5)] ring-1 ring-ink/[0.06]">
                                  {QUICK_REACTIONS.map((e) => (
                                    <button key={e} type="button" onClick={() => react(m.id, e)} aria-label={`Reageer met ${e}`} className={cn("flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-blush active:scale-90", reactions[m.id]?.some((r) => r.emoji === e && r.mine) && "bg-sage/25")}>
                                      <span className="text-[21px] leading-none">{e}</span>
                                    </button>
                                  ))}
                                  <button type="button" onClick={() => setReactPickerFor(reactPickerFor === m.id ? null : m.id)} aria-label="Andere emoji" className="flex h-9 w-9 items-center justify-center rounded-full text-ink/70 hover:bg-blush">
                                    <Plus className="h-4 w-4" strokeWidth={2} />
                                  </button>
                                </div>
                                {reactPickerFor === m.id ? <EmojiPicker className="w-[300px] max-w-[85vw]" onPick={(e) => react(m.id, e)} /> : null}
                                <div className="flex gap-1.5">
                                  {m.body ? (
                                    <button type="button" onClick={() => void copy(m.body)} className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-ink shadow-sm">
                                      <Copy className="h-3.5 w-3.5" strokeWidth={1.8} /> <span className="text-[12px] font-medium">Kopiëren</span>
                                    </button>
                                  ) : null}
                                  {href ? (
                                    <Link href={href} className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[12px] font-medium text-ink shadow-sm">
                                      Openen
                                    </Link>
                                  ) : null}
                                  {url ? (
                                    <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[12px] font-medium text-ink shadow-sm">
                                      Openen
                                    </a>
                                  ) : null}
                                  {mine && run.user_id !== BADDY_ID ? (
                                    <button type="button" onClick={() => remove(m.id)} className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-danger shadow-sm">
                                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} /> <span className="text-[12px] font-medium">Verwijderen</span>
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {typingText || baddySince ? (
          <div className="mt-2 flex items-end gap-1.5" aria-label={typingText ?? "Baddy typt"}>
            {group ? <Avatar name={baddySince ? "Baddy" : typingNames[0] ?? "?"} src={baddySince ? members[BADDY_ID]?.avatar : members[typingIds[0]]?.avatar} size="xs" className="mb-0.5 h-7 w-7" /> : null}
            <span className="flex items-center gap-1 rounded-[16px] rounded-tl-[5px] bg-white px-3.5 py-3 shadow-[0_1px_1.5px_rgba(95,53,41,0.12)]">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${i * 140}ms`, animationDuration: "1s" }} />
              ))}
            </span>
          </div>
        ) : null}
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-[#f6ece4] via-[#f6ece4]/95 to-transparent px-2.5 pt-3 md:left-[320px]"
        style={{ paddingBottom: "calc(var(--sab) + 8px)" }}
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-1.5">
          {suggestions.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 px-1" role="listbox" aria-label="Squadlid taggen">
              {suggestions.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickMention(m)}
                  className="flex items-center gap-1.5 rounded-full bg-white py-1 pl-1 pr-3 text-text shadow-sm"
                >
                  <Avatar name={members[m.id]?.name ?? m.label} src={members[m.id]?.avatar} size="xs" className="h-6 w-6 text-[10px]" />
                  <span className="text-[12.5px] font-medium">@{m.label}</span>
                </button>
              ))}
            </div>
          ) : null}
          {emojiOpen ? <EmojiPicker onPick={insertEmoji} /> : null}
          <div className="flex items-end gap-1.5">
            <div className="flex min-h-[46px] flex-1 items-end gap-0.5 rounded-[23px] bg-white px-1.5 shadow-[0_6px_18px_-12px_rgba(95,53,41,0.45)] ring-1 ring-ink/[0.05]">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setEmojiOpen((v) => !v)}
                aria-label={emojiOpen ? "Emoji sluiten" : "Emoji"}
                aria-pressed={emojiOpen}
                className={cn("flex h-[46px] w-10 shrink-0 items-center justify-center rounded-full", emojiOpen ? "text-sage" : "text-ink/60 hover:text-ink")}
              >
                <Smile className="h-[22px] w-[22px]" strokeWidth={1.7} />
              </button>
              <textarea
                ref={textarea}
                value={draft}
                onInput={onInput}
                onKeyUp={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
                onClick={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
                onKeyDown={(e) => {
                  if ((e.key === "Tab" || e.key === "Enter") && suggestions.length > 0 && !e.shiftKey) {
                    e.preventDefault();
                    pickMention(suggestions[0]);
                    return;
                  }
                  if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(pointer: fine)").matches) {
                    e.preventDefault();
                    submit();
                  }
                }}
                rows={1}
                maxLength={1000}
                placeholder={group ? "Bericht aan de squad" : `Bericht aan ${peer!.name}`}
                aria-label="Bericht"
                className="max-h-32 min-h-[46px] flex-1 resize-none bg-transparent py-[13px] text-[16px] leading-[20px] text-text outline-none placeholder:text-muted"
              />
              <button type="button" onClick={() => setAttachOpen(true)} aria-label="Bijlage toevoegen" className="flex h-[46px] w-10 shrink-0 items-center justify-center rounded-full text-ink/60 hover:text-ink">
                <Paperclip className="h-[20px] w-[20px] -rotate-45" strokeWidth={1.7} />
              </button>
            </div>
            <button
              type="submit"
              disabled={!draft.trim() || sending}
              onMouseDown={(e) => e.preventDefault()}
              aria-label="Versturen"
              className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-[#5f3529] text-paper shadow-[0_6px_18px_-10px_rgba(95,53,41,0.8)] transition disabled:opacity-40"
            >
              <ArrowUp className="h-5 w-5" strokeWidth={2.2} />
            </button>
          </div>
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
