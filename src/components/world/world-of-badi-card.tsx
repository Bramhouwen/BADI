"use client";

/**
 * World of Badi on the Squad page: a small map of the village with everyone
 * at the place they are (live when they are in the world, where they were
 * last when not), today's missions and coins, and what is waiting for you in
 * your room. Watching the map does not put you in the world.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Coins, Mail, Target } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { relativeTimeNl } from "@/lib/dates";
import { STATUSES, type StatusKey } from "@/lib/world/engine/presence";
import { readSavedStatus, saveStatus } from "@/lib/world/status-store";
import { TOUR_URL } from "@/lib/world/tour";
import { createWorldLink } from "./world-link";

/** The four places on the map, in percent of the village picture, and the scene you enter there. */
const PLACES = [
  { key: "huis", label: "Huis", x: 29, y: 31, enter: "huis" },
  { key: "dorp", label: "Dorp", x: 50, y: 56, enter: "buiten" },
  { key: "kantoor", label: "Traffic Today", x: 76, y: 31, enter: "kantoor" },
  { key: "sport", label: "Sportschool", x: 74, y: 80, enter: "sportschool" },
] as const;
type PlaceKey = (typeof PLACES)[number]["key"];

/** Which place on the map a scene belongs to: the living room and the own rooms are in the house. */
export function placeOf(scene: string | null | undefined): PlaceKey | null {
  if (!scene) return null;
  if (scene === "huis" || scene === "achtertuin" || scene.startsWith("kamer-")) return "huis";
  if (scene === "buiten") return "dorp";
  if (scene === "kantoor") return "kantoor";
  if (scene === "sportschool") return "sport";
  return null;
}

/** Short words for the status buttons on the card. */
const STATUS_SHORT: Record<StatusKey, string> = { trainen: "Trainen", werken: "Werken", chillen: "Chillen", koken: "Koken", weg: "Even weg" };

const PLACE_IN: Record<PlaceKey, string> = { huis: "thuis", dorp: "in het dorp", kantoor: "bij Traffic Today", sport: "in de sportschool" };

export interface WorldCardPerson {
  id: string;
  name: string;
  avatar: string | null;
  /** Where they were last (saved), and when. */
  scene: string | null;
  updatedAt: string | null;
}

export interface WorldCardGame {
  done: number;
  total: number;
  /** Coins still to earn today. */
  toEarn: number;
  coins: number;
  /** The next piece in the shop you can save up for. */
  next: { name: string; price: number } | null;
}

function joinNames(names: string[]): string {
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} en ${names[names.length - 1]}`;
}

export function WorldOfBadiCard({ me, challengeId, people, game, notes }: { me: string; challengeId: string; people: WorldCardPerson[]; game: WorldCardGame | null; notes: number }) {
  // Who is in the world right now, and where: watched live, without joining in.
  const [live, setLive] = useState<Map<string, { scene: string; status: StatusKey | null }>>(new Map());
  useEffect(() => {
    const link = createWorldLink(me, challengeId);
    const off = link.subscribe((e) => {
      if (e.type === "peers") setLive(new Map([...link.peers()].map(([id, p]) => [id, { scene: p.scene, status: p.status ?? null }])));
    });
    return () => {
      off();
      link.close();
    };
  }, [me, challengeId]);

  // What you are doing: picked here before you go in, and kept when you do.
  const [status, setStatus] = useState<StatusKey | null>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setStatus(readSavedStatus(me)));
    return () => cancelAnimationFrame(frame);
  }, [me]);
  const pickStatus = (s: StatusKey) => {
    const next = s === status ? null : s;
    setStatus(next);
    saveStatus(me, next);
  };

  const placed = people
    .map((p) => {
      const now = live.get(p.id);
      return { ...p, online: !!now, status: now?.status ?? null, place: placeOf(now ? now.scene : p.scene) };
    })
    .filter((p) => p.place);
  const onlineNow = placed.filter((p) => p.online && p.id !== me);
  const byPlace = new Map<PlaceKey, string[]>();
  for (const p of onlineNow) byPlace.set(p.place!, [...(byPlace.get(p.place!) ?? []), p.name]);
  const line = onlineNow.length
    ? [...byPlace.entries()].map(([k, names]) => `${joinNames(names)} ${names.length > 1 ? "zijn" : "is"} ${PLACE_IN[k]}`).join(", ")
    : (() => {
        const last = placed.filter((p) => p.id !== me && p.updatedAt).sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))[0];
        return last ? `Nu niemand in de wereld. ${last.name} was er ${relativeTimeNl(last.updatedAt!)}.` : "Nog niemand in de wereld.";
      })();

  return (
    <section aria-label="World of Badi" className="overflow-hidden rounded-[22px] bg-white/85 shadow-[0_12px_28px_-20px_rgba(95,53,41,0.45)] ring-1 ring-ink/[0.05]">
      <div className="flex items-baseline justify-between px-4 pb-2 pt-3.5">
        <h2 className="whitespace-nowrap font-display text-[22px] leading-none text-text">World of Badi</h2>
        {onlineNow.length ? (
          <span className="flex items-center gap-1.5 whitespace-nowrap text-[12px] font-semibold text-[#3f8f4f]">
            <span className="h-2 w-2 rounded-full bg-[#5aa46a]" aria-hidden /> {onlineNow.length} in de wereld
          </span>
        ) : null}
      </div>

      <div className="relative mx-3 aspect-[2000/1131] overflow-hidden rounded-[16px] bg-[#e9dccf]">
        {/* eslint-disable-next-line @next/next/no-img-element -- the village picture, drawn as is */}
        <img src="/wereld/scenes/buiten.webp" alt="" className="absolute inset-0 h-full w-full object-cover" />
        {PLACES.map((pl) => {
          const here = placed.filter((p) => p.place === pl.key);
          return (
            <Link
              key={pl.key}
              href={`/wereld?scene=${pl.enter}`}
              aria-label={`Naar ${pl.label}${here.length ? `, hier: ${here.map((p) => p.name).join(", ")}` : ""}`}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
              style={{ left: `${pl.x}%`, top: `${pl.y}%` }}
            >
              <span className="flex -space-x-2">
                {here.slice(0, 4).map((p) => (
                  <span key={p.id} className={`relative rounded-full ${p.online ? "ring-2 ring-[#5aa46a]" : "opacity-60 ring-2 ring-white"}`}>
                    <Avatar name={p.name} src={p.avatar} size="xs" className="h-7 w-7" />
                    {p.online && p.status ? (
                      <span className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-white text-[9px] leading-none shadow-sm" aria-label={STATUSES[p.status].label}>
                        {STATUSES[p.status].icon}
                      </span>
                    ) : null}
                  </span>
                ))}
              </span>
              <span className="mt-0.5 whitespace-nowrap rounded-full bg-white/90 px-2 py-0.5 text-[10.5px] font-semibold text-ink shadow-sm">{pl.label}</span>
            </Link>
          );
        })}
      </div>

      <p className="px-4 pt-2.5 text-[13px] leading-snug text-text">{line}</p>

      <div className="px-3 pt-3">
        <p className="px-1 pb-1.5 text-[12px] font-semibold text-muted">Wat ben je aan het doen?</p>
        <div className="grid grid-cols-5 gap-1.5" role="group" aria-label="Wat ben je aan het doen?">
          {(Object.keys(STATUSES) as StatusKey[]).map((k) => {
            const on = status === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => pickStatus(k)}
                aria-pressed={on}
                aria-label={STATUSES[k].label}
                className={`flex flex-col items-center gap-0.5 rounded-[14px] px-1 py-2 text-[11px] font-semibold transition-colors ${on ? "espresso" : "bg-[#f6ece4] text-text"}`}
              >
                <span className="text-[18px] leading-none" aria-hidden>
                  {STATUSES[k].icon}
                </span>
                <span className="truncate">{STATUS_SHORT[k]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 px-3 pt-3">
        {game ? (
          <div className="rounded-[14px] bg-[#f6ece4] px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-[12px] font-semibold text-muted">
              <Target className="h-3.5 w-3.5" aria-hidden /> Missies vandaag
            </p>
            <p className="mt-0.5 text-[15px] font-semibold text-text">
              {game.done} van {game.total}
            </p>
            <p className="text-[11.5px] text-muted">{game.toEarn ? `nog ${game.toEarn} munten te verdienen` : "alles gehaald vandaag"}</p>
          </div>
        ) : null}
        {game ? (
          <div className="rounded-[14px] bg-[#f6ece4] px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-[12px] font-semibold text-muted">
              <Coins className="h-3.5 w-3.5 text-[#c28a2c]" aria-hidden /> Munten
            </p>
            <p className="mt-0.5 text-[15px] font-semibold text-text">{game.coins}</p>
            <p className="truncate text-[11.5px] text-muted">{game.next ? `nog ${game.next.price - game.coins} tot ${game.next.name.toLowerCase()}` : "genoeg voor alles in de winkel"}</p>
          </div>
        ) : null}
      </div>

      {notes > 0 ? (
        <Link href="/wereld?scene=jouw-kamer" className="mx-3 mt-2 flex items-center gap-2 rounded-[14px] bg-[#fbe7c8] px-3 py-2.5 text-[13px] font-medium text-text">
          <Mail className="h-4 w-4 text-[#c9573a]" aria-hidden />
          {notes === 1 ? "Er ligt iets voor je in je kamer" : `Er liggen ${notes} dingen voor je in je kamer`}
          <ArrowRight className="ml-auto h-4 w-4 text-muted" aria-hidden />
        </Link>
      ) : null}

      <div className="p-3">
        <Link href="/wereld" className="espresso flex h-12 items-center justify-center gap-2 rounded-full text-[15px] font-semibold">
          Naar de wereld <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
        <Link href={TOUR_URL} className="mt-1 flex h-9 items-center justify-center text-[13px] font-medium text-muted">
          Rondleiding bekijken
        </Link>
      </div>
    </section>
  );
}
