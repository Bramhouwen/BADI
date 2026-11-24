"use client";

/**
 * Own rooms in BADI Wereld: the shop, the furnishing bar, visiting someone's
 * room and the notes people leave. Coins and purchases are checked by the
 * database; these panels only ask for them.
 */
import { useState } from "react";
import Image from "next/image";
import { Check, Coins, FlipHorizontal2, Mail, PackageOpen, ShoppingBag, X } from "lucide-react";
import { CATEGORY_NAMES, ITEMS, ITEM_BY_ID, itemImage, type ItemDef } from "@/lib/world/items";
import { relativeTimeNl } from "@/lib/dates";
import type { RoomNote } from "@/app/actions/world";
import { sheet } from "./world-hud";

function Header({ title, onClose, children }: { title: string; onClose: () => void; children?: React.ReactNode }) {
  return (
    <header className="flex items-center gap-2 border-b border-ink/[0.06] px-4 py-3">
      <h2 className="text-[15px] font-semibold text-text">{title}</h2>
      {children}
      <button type="button" onClick={onClose} aria-label="Sluiten" className="ml-auto grid h-9 w-9 place-items-center rounded-full text-muted">
        <X className="h-4 w-4" aria-hidden />
      </button>
    </header>
  );
}

/** The shop: every piece with its price; buy with your coins. */
export function ShopSheet({ bottom, coins, busy, onBuy, onClose }: { bottom: number | string; coins: number | null; busy: string | null; onBuy: (item: ItemDef) => void; onClose: () => void }) {
  const categories = [...new Set(ITEMS.map((i) => i.category))];
  return (
    <section aria-label="Winkel" className={`${sheet} flex max-h-[min(60%,600px)] flex-col`} style={{ bottom }}>
      <Header title="Winkel" onClose={onClose}>
        <span className="flex items-center gap-1 text-[12.5px] font-semibold text-[#9a6b1f]">
          <Coins className="h-3.5 w-3.5" aria-hidden /> {coins ?? "–"}
        </span>
      </Header>
      <div className="min-h-0 space-y-3 overflow-y-auto px-3 py-3">
        {categories.map((c) => (
          <section key={c}>
            <h3 className="mb-1.5 px-1 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-muted">{CATEGORY_NAMES[c]}</h3>
            <ul className="grid grid-cols-3 gap-2">
              {ITEMS.filter((i) => i.category === c).map((i) => {
                const short = coins !== null && coins < i.price;
                return (
                  <li key={i.id}>
                    <button
                      type="button"
                      disabled={short || busy !== null}
                      onClick={() => onBuy(i)}
                      className="flex w-full flex-col items-center gap-1 rounded-[16px] bg-[#f6ece4] px-2 pb-2 pt-2.5 text-center disabled:opacity-55"
                    >
                      <Image src={itemImage(i.id)} alt="" width={96} height={80} className="h-[64px] w-auto object-contain" />
                      <span className="w-full truncate text-[12.5px] font-semibold text-text">{i.name}</span>
                      <span className="flex items-center gap-1 text-[12px] font-semibold text-[#9a6b1f]">
                        {busy === i.id ? "Kopen…" : <><Coins className="h-3 w-3" aria-hidden /> {i.price}</>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        <p className="px-1 text-[12px] text-muted">Munten verdien je met inchecken, trainen, water en stappen in BADI.</p>
      </div>
    </section>
  );
}

/** Furnishing your room: what is in storage, and what to do with the piece you tapped. */
export function FurnishBar({
  bottom,
  storage,
  selected,
  onPlace,
  onFlip,
  onStore,
  onShop,
  onDone,
}: {
  bottom: number | string;
  storage: { id: string; itemId: string }[];
  selected: string | null;
  onPlace: (piece: { id: string; itemId: string }) => void;
  onFlip: () => void;
  onStore: () => void;
  onShop: () => void;
  onDone: () => void;
}) {
  const item = selected ? ITEM_BY_ID.get(selected) : null;
  return (
    <section aria-label="Inrichten" className={`${sheet} space-y-2 p-3`} style={{ bottom }}>
      <div className="flex items-center gap-2 px-1">
        <h2 className="text-[15px] font-semibold text-text">Inrichten</h2>
        <span className="truncate text-[12px] text-muted">{item ? `${item.name}: sleep om te verplaatsen` : "tik op een meubel, of sleep het"}</span>
      </div>
      {item ? (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onFlip} className="flex h-11 items-center justify-center gap-1.5 rounded-[14px] bg-[#f6ece4] text-[13px] font-semibold text-text">
            <FlipHorizontal2 className="h-4 w-4" aria-hidden /> Draaien
          </button>
          <button type="button" onClick={onStore} className="flex h-11 items-center justify-center gap-1.5 rounded-[14px] bg-[#f6ece4] text-[13px] font-semibold text-text">
            <PackageOpen className="h-4 w-4" aria-hidden /> Opbergen
          </button>
        </div>
      ) : storage.length ? (
        <ul className="flex gap-2 overflow-x-auto pb-1">
          {storage.map((s) => {
            const it = ITEM_BY_ID.get(s.itemId);
            if (!it) return null;
            return (
              <li key={s.id} className="shrink-0">
                <button type="button" onClick={() => onPlace(s)} aria-label={`${it.name} neerzetten`} className="grid h-16 w-16 place-items-center rounded-[14px] bg-[#f6ece4]">
                  <Image src={itemImage(it.id)} alt="" width={56} height={48} className="h-12 w-auto object-contain" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="px-1 text-[12.5px] text-muted">Je opslag is leeg. Koop iets in de winkel.</p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onShop} className="flex h-11 items-center justify-center gap-1.5 rounded-[14px] bg-[#f6ece4] text-[13px] font-semibold text-text">
          <ShoppingBag className="h-4 w-4" aria-hidden /> Winkel
        </button>
        <button type="button" onClick={onDone} className="flex h-11 items-center justify-center gap-1.5 espresso rounded-[14px] text-[13px] font-semibold">
          <Check className="h-4 w-4" aria-hidden /> Klaar
        </button>
      </div>
    </section>
  );
}

/** In someone else's room: leave a note or a high five for when they come back. */
export function VisitCard({ bottom, owner, onLeave, onClose }: { bottom: number | string; owner: string; onLeave: (kind: "briefje" | "highfive", body?: string) => Promise<boolean>; onClose: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const leave = async (kind: "briefje" | "highfive") => {
    setBusy(true);
    const ok = await onLeave(kind, kind === "briefje" ? text.trim() : undefined);
    setBusy(false);
    if (ok) {
      setText("");
      setDone(kind === "briefje" ? `Je briefje ligt klaar voor ${owner}.` : `${owner} vindt je high five als die thuiskomt.`);
    }
  };
  return (
    <section aria-label={`Iets achterlaten voor ${owner}`} className={`${sheet} space-y-2 p-3`} style={{ bottom }}>
      <div className="flex items-center gap-2 px-1">
        <h2 className="text-[15px] font-semibold text-text">Iets achterlaten</h2>
        <span className="truncate text-[12px] text-muted">alleen {owner} ziet het</span>
        <button type="button" onClick={onClose} aria-label="Sluiten" className="ml-auto grid h-8 w-8 place-items-center rounded-full text-muted">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      {done ? <p className="px-1 text-[13px] text-[#3f8f4f]">{done}</p> : null}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={200}
        rows={2}
        placeholder={`Briefje voor ${owner}…`}
        className="w-full resize-none rounded-[14px] bg-[#f6ece4] px-3 py-2 text-[16px] text-text outline-none placeholder:text-muted"
      />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={busy} onClick={() => leave("highfive")} className="flex h-11 items-center justify-center gap-1.5 rounded-[14px] bg-[#f6ece4] text-[13px] font-semibold text-text disabled:opacity-50">
          <span aria-hidden>🙌</span> High five
        </button>
        <button type="button" disabled={busy || !text.trim()} onClick={() => leave("briefje")} className="flex h-11 items-center justify-center gap-1.5 espresso rounded-[14px] text-[13px] font-semibold disabled:opacity-40">
          <Mail className="h-4 w-4" aria-hidden /> Briefje achterlaten
        </button>
      </div>
    </section>
  );
}

/** What people left in your room. */
export function NotesSheet({ bottom, notes, nameOf, onClose }: { bottom: number | string; notes: RoomNote[]; nameOf: (id: string) => string; onClose: () => void }) {
  return (
    <section aria-label="Achtergelaten in je kamer" className={`${sheet} flex max-h-[min(70%,560px)] flex-col`} style={{ bottom }}>
      <Header title="Achtergelaten in je kamer" onClose={onClose} />
      <ul className="min-h-0 space-y-2 overflow-y-auto px-3 py-3">
        {notes.length === 0 ? <li className="px-1 text-[13px] text-muted">Nog niets. Als iemand op bezoek komt, kan die hier een briefje of high five achterlaten.</li> : null}
        {notes.map((n) => (
          <li key={n.id} className={`rounded-[14px] px-3 py-2 ${n.read ? "bg-[#f6ece4]" : "bg-[#fbe7c8]"}`}>
            <p className="text-[12px] text-muted">
              {nameOf(n.author)} · {relativeTimeNl(n.at)}
            </p>
            <p className="text-[14px] text-text">{n.kind === "highfive" ? "🙌 Gaf je een high five" : n.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
