"use client";

/**
 * Private messages in World of Badi: the post box, a conversation panel and the
 * live feed of new private messages. It is the app's own private chat, so
 * everything here is also in Squad > Chat, and the database only lets the two
 * people in a conversation read it.
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ChevronLeft, ExternalLink, SendHorizontal, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isDemo } from "@/lib/demo";
import { relativeTimeNl } from "@/lib/dates";
import { attachmentLabel, type ChatMessage } from "@/lib/chat";
import { dmKey } from "@/lib/conversations";
import { announceTyping, receiveTyping, stopTyping, useTyping } from "@/lib/presence";
import { markChatRead, sendMessage } from "@/app/actions/chat";
import { loadWorldThread, type WorldInboxItem } from "@/app/actions/world";
import { dmPeer, type WorldDm } from "@/lib/world/dm";

/** New private messages you send or receive, live. Only the two people in a conversation receive its messages. */
export function useLiveDms(me: string, challengeId: string, enabled: boolean, onDm: (dm: WorldDm) => void) {
  const handler = useRef(onDm);
  useEffect(() => {
    handler.current = onDm;
  });
  useEffect(() => {
    if (!enabled) return;
    if (isDemo()) {
      // Demo: Sam writes you a private message after a while.
      const sam = "00000000-0000-4000-8000-000000000002";
      const t1 = setTimeout(() => receiveTyping(dmKey(sam), sam), 12000);
      const t2 = setTimeout(() => {
        stopTyping(dmKey(sam), sam);
        handler.current({ id: `demo-${Date.now()}`, from: sam, to: me, text: "Zin om straks samen te trainen?", at: new Date().toISOString() });
      }, 16000);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      return;
    }
    const channel = supabase
      .channel(`wereld-post:${me}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "squad_messages", filter: `challenge_id=eq.${challengeId}` }, (payload) => {
        const m = payload.new as ChatMessage;
        const peer = m?.id ? dmPeer(m, me) : null;
        if (!peer) return;
        stopTyping(dmKey(m.user_id), m.user_id);
        handler.current({ id: m.id, from: m.user_id, to: m.recipient_id ?? "", text: m.body || attachmentLabel(m) || "Bijlage", at: m.created_at });
      })
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [me, challengeId, enabled]);
}

const panel = "absolute inset-x-3 mx-auto flex max-h-[min(70%,560px)] max-w-md flex-col overflow-hidden rounded-[22px] bg-white/97 shadow-xl ring-1 ring-ink/[0.06] backdrop-blur";

/** Your private conversations, newest first, with unread counts and where everyone is. */
export function WorldPostBox({
  items,
  unread,
  where,
  bottom,
  onOpen,
  onClose,
}: {
  items: WorldInboxItem[] | null;
  unread: Readonly<Record<string, number>>;
  /** Room name per member who is online now. */
  where: ReadonlyMap<string, string>;
  bottom: number | string;
  onOpen: (peer: { id: string; name: string }) => void;
  onClose: () => void;
}) {
  return (
    <section aria-label="Postvak" className={panel} style={{ bottom }}>
      <header className="flex items-center gap-2 border-b border-ink/[0.06] px-4 py-3">
        <h2 className="text-[15px] font-semibold text-text">Postvak</h2>
        <button type="button" onClick={onClose} aria-label="Sluiten" className="ml-auto grid h-9 w-9 place-items-center rounded-full text-muted">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </header>
      <ul className="min-h-0 overflow-y-auto py-1">
        {items === null ? <li className="px-4 py-3 text-[13.5px] text-muted">Laden…</li> : null}
        {items?.map((i) => {
          const n = unread[i.userId] ?? 0;
          const room = where.get(i.userId);
          return (
            <li key={i.userId}>
              <button type="button" onClick={() => onOpen({ id: i.userId, name: i.name })} className="flex w-full items-center gap-3 px-4 py-2.5 text-left">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${room ? "bg-[#3f8f4f]" : "bg-ink/15"}`} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className={`truncate text-[14.5px] ${n ? "font-semibold" : "font-medium"} text-text`}>{i.name}</span>
                    {room ? <span className="truncate text-[11.5px] text-muted">{room}</span> : null}
                  </span>
                  <span className={`block truncate text-[12.5px] ${n ? "text-text" : "text-muted"}`}>{i.preview ?? "Nog geen berichten"}</span>
                </span>
                {n ? <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#c9573a] px-1.5 text-[11px] font-bold text-white">{n > 9 ? "9+" : n}</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** One private conversation in the world, with the same messages as in Squad > Chat. */
export function WorldThread({
  me,
  peer,
  incoming,
  bottom,
  onSent,
  onBack,
  onClose,
  onFocusInput,
}: {
  me: string;
  peer: { id: string; name: string };
  /** Private messages with this person that came in live while the panel is open. */
  incoming: WorldDm[];
  bottom: number | string;
  onSent: (dm: WorldDm) => void;
  onBack: () => void;
  onClose: () => void;
  onFocusInput: () => void;
}) {
  const [loaded, setLoaded] = useState<WorldDm[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<WorldDm[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);
  const typing = useTyping(dmKey(peer.id)).length > 0;

  useEffect(() => {
    let alive = true;
    void loadWorldThread(peer.id).then((r) => {
      if (!alive) return;
      if (r.ok && r.data) setLoaded(r.data.messages);
      else setError(r.ok ? "Laden is niet gelukt." : r.error);
    });
    void markChatRead(peer.id);
    return () => {
      alive = false;
    };
  }, [peer.id]);

  // Everything new is read right away while this conversation is open.
  const lastIncoming = incoming[incoming.length - 1]?.id;
  useEffect(() => {
    if (lastIncoming) void markChatRead(peer.id);
  }, [lastIncoming, peer.id]);

  const byId = new Map<string, WorldDm>();
  for (const m of [...(loaded ?? []), ...sent, ...incoming]) byId.set(m.id, m);
  const messages = [...byId.values()].sort((a, b) => a.at.localeCompare(b.at)).slice(-40);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    const r = await sendMessage({ body, to: peer.id });
    setBusy(false);
    if (!r.ok || !r.data) return setError(r.ok ? "Versturen is niet gelukt." : r.error);
    setText("");
    setError(null);
    const dm: WorldDm = { id: r.data.id, from: me, to: peer.id, text: r.data.body, at: r.data.created_at };
    setSent((list) => [...list, dm]);
    onSent(dm);
  }

  return (
    <section aria-label={`Gesprek met ${peer.name}`} className={panel} style={{ bottom }}>
      <header className="flex items-center gap-1 border-b border-ink/[0.06] px-2 py-2">
        <button type="button" onClick={onBack} aria-label="Naar het postvak" className="grid h-9 w-9 place-items-center rounded-full text-muted">
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-semibold leading-tight text-text">{peer.name}</h2>
          {typing ? <p className="text-[11.5px] leading-tight text-muted">typt…</p> : null}
        </div>
        <Link href={`/squad/chat/${peer.id}`} className="ml-auto flex h-9 items-center gap-1 rounded-full px-2.5 text-[12.5px] font-medium text-ink">
          Open in chat <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </Link>
        <button type="button" onClick={onClose} aria-label="Sluiten" className="grid h-9 w-9 place-items-center rounded-full text-muted">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </header>
      <ol ref={listRef} className="min-h-[120px] flex-1 space-y-1.5 overflow-y-auto px-3 py-3">
        {loaded === null && !error ? <li className="text-center text-[13px] text-muted">Laden…</li> : null}
        {loaded !== null && messages.length === 0 ? <li className="text-center text-[13px] text-muted">Nog geen berichten. Alleen {peer.name} en jij zien wat je hier schrijft.</li> : null}
        {messages.map((m) => {
          const mine = m.from === me;
          return (
            <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <span className={`max-w-[78%] rounded-[16px] px-3 py-1.5 text-[14px] leading-snug ${mine ? "bg-[#6b3d30] text-paper" : "bg-[#f3e9e1] text-text"}`} title={relativeTimeNl(m.at)}>
                {m.text}
              </span>
            </li>
          );
        })}
      </ol>
      {error ? <p className="px-4 pb-1 text-[12.5px] text-danger">{error}</p> : null}
      <form onSubmit={submit} className="flex items-center gap-2 border-t border-ink/[0.06] p-2 pl-4">
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (e.target.value) announceTyping(peer.id);
          }}
          onFocus={onFocusInput}
          maxLength={2000}
          enterKeyHint="send"
          placeholder={`Bericht aan ${peer.name}…`}
          aria-label={`Bericht aan ${peer.name}`}
          className="min-w-0 flex-1 bg-transparent text-[16px] text-text outline-none placeholder:text-muted"
        />
        <button type="submit" disabled={!text.trim() || busy} aria-label="Versturen" className="espresso grid h-10 w-10 shrink-0 place-items-center rounded-full disabled:opacity-40">
          <SendHorizontal className="h-4.5 w-4.5" aria-hidden />
        </button>
      </form>
    </section>
  );
}
