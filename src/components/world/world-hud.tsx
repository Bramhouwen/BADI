"use client";

/**
 * The game controls of World of Badi: the action bar at the bottom and the
 * panels it opens (do something, status, map, missions), plus the choice at
 * a treadmill. Plain buttons over the world; the world itself stays drawn.
 */
import Link from "next/link";
import { Check, CircleDashed, Coins, Footprints, Hand, Map as MapIcon, Smile, Sparkles, Target, X } from "lucide-react";
import { SCENES } from "@/lib/world/scenes";
import { ACTIONS, STATUSES, type StatusKey } from "@/lib/world/engine/presence";
import type { Spot } from "@/lib/world/engine/scene";
import type { WorldGame } from "@/lib/world/missions-server";

export type HudPanel = "acties" | "status" | "kaart" | "missies";

const round = "pointer-events-auto grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/95 text-ink shadow-md ring-1 ring-ink/[0.06] backdrop-blur";
export const sheet = "absolute inset-x-3 mx-auto max-w-md overflow-hidden rounded-[22px] bg-white/97 shadow-xl ring-1 ring-ink/[0.06] backdrop-blur";

/** The row of round buttons above "Zeg iets". */
export function ActionBar({ open, onOpen, status }: { open: HudPanel | null; onOpen: (p: HudPanel | null) => void; status: StatusKey | null }) {
  const button = (p: HudPanel, label: string, icon: React.ReactNode) => (
    <button type="button" data-tour={p} onClick={() => onOpen(open === p ? null : p)} aria-label={label} aria-expanded={open === p} className={`${round} ${open === p ? "ring-2 ring-[#2b1d18]" : ""}`}>
      {icon}
    </button>
  );
  return (
    <div className="flex items-center gap-2">
      {button("acties", "Doe iets", <Hand className="h-5 w-5" aria-hidden />)}
      {button("status", status ? `Status: ${STATUSES[status].label}` : "Status kiezen", status ? <span className="text-[20px] leading-none">{STATUSES[status].icon}</span> : <Smile className="h-5 w-5" aria-hidden />)}
      {button("kaart", "Kaart", <MapIcon className="h-5 w-5" aria-hidden />)}
      {button("missies", "Missies", <Target className="h-5 w-5" aria-hidden />)}
    </div>
  );
}

function SheetHeader({ title, onClose, children }: { title: string; onClose: () => void; children?: React.ReactNode }) {
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

/** Wave, cheer or dance for everyone in the room to see. */
export function ActionsSheet({ bottom, onAct, onClose }: { bottom: number | string; onAct: (kind: "zwaai" | "juich" | "dans") => void; onClose: () => void }) {
  return (
    <section aria-label="Doe iets" className={sheet} style={{ bottom }}>
      <SheetHeader title="Doe iets" onClose={onClose}>
        <span className="text-[12px] text-muted">iedereen in de ruimte ziet het</span>
      </SheetHeader>
      <div className="grid grid-cols-3 gap-2 p-3">
        {(["zwaai", "juich", "dans"] as const).map((k) => (
          <button key={k} type="button" onClick={() => onAct(k)} className="flex h-16 flex-col items-center justify-center gap-1 rounded-[16px] bg-[#f6ece4] text-[13px] font-semibold text-text">
            <span className="text-[22px] leading-none" aria-hidden>
              {k === "zwaai" ? "👋" : k === "juich" ? "🙌" : "💃"}
            </span>
            {ACTIONS[k].label}
          </button>
        ))}
      </div>
    </section>
  );
}

/** What you are up to, as an icon over your head. */
export function StatusSheet({ bottom, status, onPick, onClose }: { bottom: number | string; status: StatusKey | null; onPick: (s: StatusKey | null) => void; onClose: () => void }) {
  return (
    <section aria-label="Wat ben je aan het doen?" className={sheet} style={{ bottom }}>
      <SheetHeader title="Wat ben je aan het doen?" onClose={onClose} />
      <ul className="py-1">
        {(Object.keys(STATUSES) as StatusKey[]).map((k) => (
          <li key={k}>
            <button type="button" onClick={() => onPick(k)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left">
              <span className="text-[20px] leading-none" aria-hidden>
                {STATUSES[k].icon}
              </span>
              <span className="flex-1 text-[14.5px] text-text">{STATUSES[k].label}</span>
              {status === k ? <Check className="h-4 w-4 text-[#3f8f4f]" aria-label="gekozen" /> : null}
            </button>
          </li>
        ))}
        {status ? (
          <li>
            <button type="button" onClick={() => onPick(null)} className="w-full px-4 py-2.5 text-left text-[13.5px] text-muted">
              Geen status
            </button>
          </li>
        ) : null}
      </ul>
    </section>
  );
}

/** The four places with who is there; tap one to go there. */
export function MapSheet({
  bottom,
  here,
  people,
  onGo,
  onClose,
  myRoom = null,
}: {
  bottom: number | string;
  here: string;
  /** Your own room's scene id: shown as "Jouw kamer". */
  myRoom?: string | null;
  /** Who is online in which scene, with their status. */
  people: { id: string; name: string; scene: string; status: StatusKey | null }[];
  onGo: (scene: string) => void;
  onClose: () => void;
}) {
  const order = ["woonkamer", "buiten", "kantoor", "sportschool"].filter((id) => SCENES[id]);
  // Own rooms after the shared places, yours first.
  const rooms = Object.values(SCENES)
    .filter((s) => s.owner)
    .sort((a, b) => (a.id === myRoom ? -1 : b.id === myRoom ? 1 : a.name.localeCompare(b.name)))
    .map((s) => s.id);
  return (
    <section aria-label="Kaart" className={`${sheet} flex max-h-[min(72%,600px)] flex-col`} style={{ bottom }}>
      <SheetHeader title="Kaart" onClose={onClose}>
        <span className="text-[12px] text-muted">tik op een plek om erheen te gaan</span>
      </SheetHeader>
      <ul className="grid min-h-0 grid-cols-2 gap-2 overflow-y-auto p-3">
        {[...order, ...rooms].map((id) => {
          const s = SCENES[id];
          const there = people.filter((p) => p.scene === id);
          const mine = id === here;
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => (mine ? onClose() : onGo(id))}
                className={`relative block h-[118px] w-full overflow-hidden rounded-[16px] text-left ring-1 ${mine ? "ring-2 ring-[#2b1d18]" : "ring-ink/[0.08]"}`}
                style={{ backgroundImage: `url(${s.background})`, backgroundSize: "cover", backgroundPosition: "center" }}
              >
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-2.5 pb-2 pt-6">
                  <span className="block truncate text-[13.5px] font-semibold text-white">{id === myRoom ? "Jouw kamer" : s.name}</span>
                  <span className="block truncate text-[11.5px] text-white/85">{mine ? "Jij bent hier" : there.length ? there.map((p) => p.name).join(", ") : "Niemand"}</span>
                </span>
                {there.length ? (
                  <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-ink">{there.length}</span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      {people.length ? (
        <ul className="space-y-1 border-t border-ink/[0.06] px-4 py-3 text-[13px]">
          {people.map((p) => (
            <li key={p.id} className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-[#3f8f4f]" aria-hidden />
              <span className="font-semibold text-text">{p.name}</span>
              {p.status ? <span className="truncate text-muted">{STATUSES[p.status].icon} {STATUSES[p.status].label}</span> : null}
              <span className="ml-auto truncate text-muted">{SCENES[p.scene]?.name ?? "In de wereld"}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** Today's missions from what you really did in BADI, and your coins. */
export function MissionsSheet({ bottom, game, onClose }: { bottom: number | string; game: WorldGame | null; onClose: () => void }) {
  return (
    <section aria-label="Missies van vandaag" className={`${sheet} flex max-h-[min(72%,600px)] flex-col`} style={{ bottom }}>
      <SheetHeader title="Missies van vandaag" onClose={onClose}>
        {game ? (
          <span className="flex items-center gap-1 text-[12.5px] font-semibold text-[#9a6b1f]">
            <Coins className="h-3.5 w-3.5" aria-hidden /> +{game.coinsToday} vandaag
          </span>
        ) : null}
      </SheetHeader>
      {!game ? <p className="px-4 py-4 text-[13.5px] text-muted">Laden…</p> : null}
      {game ? (
        <ul className="min-h-0 overflow-y-auto py-1">
          {game.missions.map((m) => (
            <li key={m.key} className="flex items-center gap-3 px-4 py-2.5">
              {m.done ? <Check className="h-5 w-5 shrink-0 text-[#3f8f4f]" aria-label="gedaan" /> : <CircleDashed className="h-5 w-5 shrink-0 text-ink/30" aria-label="nog te doen" />}
              <span className="min-w-0 flex-1">
                <span className={`block text-[14.5px] ${m.done ? "text-muted" : "font-medium text-text"}`}>{m.title}</span>
                {m.progress ? <span className="block text-[12px] text-muted">{m.progress}</span> : null}
              </span>
              <span className="text-[12.5px] font-semibold text-[#9a6b1f]">+{m.coins}</span>
              {!m.done ? (
                <Link href={m.href} className="espresso rounded-full px-3 py-1.5 text-[12.5px] font-semibold">
                  Doen
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {game ? (
        <div className="space-y-2 border-t border-ink/[0.06] px-4 py-3">
          {game.canSpin ? (
            <Link href="/wheel" className="flex items-center justify-center gap-2 rounded-full bg-[#f6ece4] py-2.5 text-[13.5px] font-semibold text-ink">
              <Sparkles className="h-4 w-4" aria-hidden /> Draai het Weekrad
            </Link>
          ) : null}
          <p className="text-[12.5px] text-muted">
            Je hebt <span className="font-semibold text-text">{game.coins}</span> munten. Uitgeven kan straks in je eigen kamer.
          </p>
        </div>
      ) : null}
    </section>
  );
}

/** At a treadmill: run here, or log a real training in the app. */
export function SpotChoice({ spot, bottom, onDo, onClose }: { spot: Spot; bottom: number | string; onDo: () => void; onClose: () => void }) {
  return (
    <section aria-label={spot.label} className={sheet} style={{ bottom }}>
      <SheetHeader title={spot.label} onClose={onClose} />
      <div className="grid grid-cols-2 gap-2 p-3">
        <button type="button" onClick={onDo} className="flex h-14 items-center justify-center gap-2 rounded-[16px] bg-[#f6ece4] text-[14px] font-semibold text-text">
          <Footprints className="h-4 w-4" aria-hidden /> Rennen
        </button>
        {spot.link ? (
          <Link href={spot.link.href} className="espresso flex h-14 items-center justify-center rounded-[16px] text-[14px] font-semibold">
            {spot.link.label}
          </Link>
        ) : null}
      </div>
    </section>
  );
}

/** Your coins, top right. */
export function CoinChip({ coins, onClick }: { coins: number | null; onClick: () => void }) {
  return (
    <button type="button" data-tour="munten" onClick={onClick} aria-label={coins === null ? "Munten" : `${coins} munten`} className="pointer-events-auto flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-white/90 px-3.5 text-[13.5px] font-semibold text-ink shadow-md ring-1 ring-ink/[0.06] backdrop-blur">
      <Coins className="h-4 w-4 text-[#c28a2c]" aria-hidden />
      {coins ?? "–"}
    </button>
  );
}
