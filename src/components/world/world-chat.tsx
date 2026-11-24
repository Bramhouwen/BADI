"use client";

/**
 * Reading back what was said in this room: the last lines with name and
 * time, newest at the bottom. Only what came in while you had the world open.
 */
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { clockOf, type LoggedLine } from "@/lib/world/chat-log";
import { sheet } from "./world-hud";

export function ChatLogSheet({ lines, me, room, bottom, onClose }: { lines: LoggedLine[]; me: string; room: string; bottom: number | string; onClose: () => void }) {
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length]);

  return (
    <section aria-label={`Gesprek in ${room}`} className={sheet} style={{ bottom }}>
      <header className="flex items-center gap-2 border-b border-ink/[0.06] px-4 py-3">
        <h2 className="text-[15px] font-semibold text-text">Gesprek in {room}</h2>
        <button type="button" onClick={onClose} aria-label="Sluiten" className="ml-auto grid h-9 w-9 place-items-center rounded-full text-muted">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </header>
      {lines.length ? (
        <ol ref={list} className="max-h-[38vh] space-y-2 overflow-y-auto px-4 py-3">
          {lines.map((l) => (
            <li key={`${l.at}-${l.from}`} className="text-[14px] leading-snug text-text">
              <span className="font-semibold">{l.from === me ? "Jij" : l.name}</span>
              <span className="ml-1.5 text-[11.5px] tabular-nums text-muted">{clockOf(l.at)}</span>
              <p className="break-words">{l.text}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="px-4 py-4 text-[13.5px] text-muted">Nog niets gezegd in {room} sinds je de wereld opende.</p>
      )}
    </section>
  );
}
