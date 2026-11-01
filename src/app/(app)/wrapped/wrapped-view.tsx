"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Download } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Page } from "@/components/ui/page";
import { useToast } from "@/components/ui/toast";
import { firstName } from "@/lib/utils";
import type { GroupWrapped, PersonalWrapped } from "@/lib/wrapped";
import type { WrappedStatus } from "@/lib/dates";
import { renderRecapImage } from "./recap-image";

type Personal = PersonalWrapped & { avatarUrl: string | null };

function Stat({ value, label, tone }: { value: number | string; label: string; tone?: "ice" | "gold" | "warm" }) {
  const color = tone === "gold" ? "text-gold" : tone === "warm" ? "text-warm" : "text-ice";
  return (
    <div className="rounded-[18px] border border-border/60 bg-card p-4">
      <div className={`text-3xl font-extrabold tabular-nums tracking-tight ${color}`}>{value}</div>
      <div className="mt-1 text-xs font-medium text-muted">{label}</div>
    </div>
  );
}

export function WrappedView({
  status,
  challengeName,
  meId,
  group,
  personal,
  memories,
}: {
  status: WrappedStatus;
  challengeName: string;
  meId: string;
  group: GroupWrapped;
  personal: Personal[];
  memories: { id: string; url: string | null; caption: string | null }[];
}) {
  const reduce = useReducedMotion();
  const toast = useToast();
  const [exporting, setExporting] = useState(false);
  const me = personal.find((p) => p.member.id === meId);
  const fade = (i: number) => (reduce ? {} : { initial: { opacity: 0, y: 14 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-40px" }, transition: { delay: i * 0.05 } });

  async function exportRecap() {
    if (!me) return;
    setExporting(true);
    try {
      const blob = await renderRecapImage({ name: firstName(me.member.display_name), challengeName, personal: me, group });
      const url = URL.createObjectURL(blob);
      const file = new File([blob], "winter-arc-wrapped.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Winter Arc Wrapped" });
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = "winter-arc-wrapped.png";
        a.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      toast("Exporteren lukte niet op dit apparaat.", "error");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="bg-[radial-gradient(ellipse_at_top,rgba(125,211,252,0.12),transparent_55%)]">
      <Page className="space-y-8 pt-6">
        <motion.header {...fade(0)} className="text-center">
          <p className="text-xs font-semibold tracking-[0.3em] text-gold">{status === "final" ? "WINTER ARC WRAPPED" : "VOORLOPIGE WRAPPED"}</p>
          <h1 className="mt-2 text-4xl font-extrabold leading-tight tracking-tight">
            We showed up.
            <br />
            We grew together.
          </h1>
          <p className="mt-3 text-sm text-muted">
            {status === "final"
              ? `Dit was ${challengeName}. Geen winnaar, geen podium: vier vrienden die bleven komen.`
              : "De finale is bezig. Dit overzicht wordt definitief zodra de laatste check-ins binnen zijn."}
          </p>
        </motion.header>

        <motion.section {...fade(1)}>
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">Samen</h2>
          <div className="grid grid-cols-2 gap-3">
            <Stat value={group.totalCheckinDays} label="check-in dagen bij elkaar" />
            <Stat value={group.activeChallengeDays} label={`van ${group.challengeLength} dagen iemand actief`} />
            <Stat value={group.fullSquadDays} label="dagen met de hele squad" tone="gold" />
            <Stat value={group.longestStreakInGroup} label="langste streak in de groep" tone="warm" />
            <Stat value={group.totalPhotos} label="foto's op de Wall" />
            <Stat value={group.totalRecipes} label="recepten gedeeld" />
            <Stat value={group.totalCompliments} label="complimenten uitgedeeld" tone="gold" />
          </div>
        </motion.section>

        {me ? (
          <motion.section {...fade(2)} className="rounded-[24px] border border-ice/40 bg-card p-5 shadow-[var(--shadow-glow)]">
            <div className="flex items-center gap-3">
              <Avatar name={me.member.display_name} src={me.avatarUrl} size="lg" ring />
              <div>
                <p className="text-xs font-semibold tracking-[0.2em] text-ice">JOUW WINTER ARC</p>
                <h2 className="text-xl font-bold">{firstName(me.member.display_name)}</h2>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-3xl font-extrabold tabular-nums">{me.totalDays}</div>
                <div className="text-[11px] text-muted">dagen</div>
              </div>
              <div>
                <div className="text-3xl font-extrabold tabular-nums text-warm">{me.longestStreak}</div>
                <div className="text-[11px] text-muted">langste streak</div>
              </div>
              <div>
                <div className="text-3xl font-extrabold tabular-nums text-gold">{me.complimentsReceived}</div>
                <div className="text-[11px] text-muted">complimenten</div>
              </div>
            </div>
            <ul className="mt-4 space-y-1.5 text-sm">
              <li>
                <span className="text-muted">Vaakst gekozen:</span> {me.topActivity ? `${me.topActivity.emoji} ${me.topActivity.label} (${me.topActivity.count}x)` : "nog geen check-ins"}
              </li>
              <li>
                <span className="text-muted">Gedeeld:</span> {me.photosShared} {me.photosShared === 1 ? "foto" : "foto's"} en {me.recipesShared} {me.recipesShared === 1 ? "recept" : "recepten"}
              </li>
              <li>
                <span className="text-muted">Uitgedeeld:</span> {me.complimentsSent} {me.complimentsSent === 1 ? "compliment" : "complimenten"}
              </li>
            </ul>
            <Button variant="secondary" className="mt-5 w-full" onClick={exportRecap} loading={exporting}>
              <Download className="h-4 w-4" /> Bewaar mijn recap als afbeelding
            </Button>
          </motion.section>
        ) : null}

        <motion.section {...fade(3)}>
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">De squad</h2>
          <ul className="space-y-2">
            {personal.map((p) => (
              <li key={p.member.id} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-3 py-3">
                <Avatar name={p.member.display_name} src={p.avatarUrl} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{firstName(p.member.display_name)}</p>
                  <p className="text-xs text-muted">
                    {p.totalDays} dagen · streak {p.longestStreak} · {p.topActivity ? `${p.topActivity.emoji} ${p.topActivity.label}` : "nog geen check-ins"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </motion.section>

        {memories.length > 0 ? (
          <motion.section {...fade(4)}>
            <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">Memories</h2>
            <div className="grid grid-cols-3 gap-2">
              {memories.map((m) => (
                <Link key={m.id} href={`/wall/${m.id}`} className="relative aspect-square overflow-hidden rounded-xl bg-card">
                  {m.url ? <Image src={m.url} alt={m.caption ?? "Herinnering"} fill sizes="33vw" className="object-cover" unoptimized /> : null}
                </Link>
              ))}
            </div>
          </motion.section>
        ) : null}

        <motion.footer {...fade(5)} className="rounded-[24px] bg-gradient-to-b from-card to-bg-2 px-6 py-10 text-center">
          <p className="text-2xl font-extrabold leading-snug tracking-tight">
            WE SHOWED UP.
            <br />
            WE GREW TOGETHER.
            <br />
            <span className="text-ice">THIS WAS OUR WINTER ARC.</span>
          </p>
          <p className="mt-4 text-4xl" aria-hidden>
            ❄️
          </p>
        </motion.footer>
      </Page>
    </div>
  );
}
