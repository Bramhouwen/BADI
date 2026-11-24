"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { sendWorldTour, sendWorldTourTest } from "@/app/actions/world-tour";
import { TOUR_URL, WORLD_TOUR } from "@/lib/world/tour";

/** Admin only: try the World of Badi tour, send its push to yourself, then send it to the squad. */
export function WorldTourControls({ sent, open }: { sent: boolean; open: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);

  function test() {
    setNote(null);
    start(async () => {
      const res = await sendWorldTourTest();
      setNote(res.ok ? { text: `Test-melding verstuurd naar ${res.data?.devices ?? 1} ${res.data?.devices === 1 ? "toestel" : "toestellen"} van jou. Tik erop voor de rondleiding.`, error: false } : { text: res.error, error: true });
    });
  }

  function sendAll() {
    setNote(null);
    start(async () => {
      const res = await sendWorldTour();
      setConfirm(false);
      setNote(res.ok ? { text: "Verstuurd. Baddy heeft het in de squadchat gezet en iedereen krijgt een melding.", error: false } : { text: res.error, error: true });
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="glass space-y-3 rounded-[22px] p-4">
      <div>
        <p className="text-[14px] font-medium text-text">World of Badi met rondleiding</p>
        <p className="mt-0.5 text-[12.5px] leading-snug text-muted">
          {sent
            ? "Verstuurd. Iedereen krijgt de rondleiding de eerste keer dat ze de wereld openen."
            : open
              ? "Nog niet verstuurd."
              : "Nog niet verstuurd. De wereld staat nog alleen voor jou open (WORLD_OPEN), dus je kunt nu alleen testen."}
        </p>
      </div>
      <blockquote className="rounded-[14px] bg-white/70 px-3 py-2 text-[12.5px] leading-snug text-text">
        <span className="font-medium">Melding:</span> {WORLD_TOUR.push.title} {WORLD_TOUR.push.body}
      </blockquote>
      <div className="flex flex-wrap gap-2">
        <Link href={TOUR_URL}>
          <Button variant="secondary" size="sm">Bekijk rondleiding</Button>
        </Link>
        {!sent ? (
          <Button variant="secondary" size="sm" onClick={test} loading={pending && !confirm}>
            Test-melding naar mij
          </Button>
        ) : null}
      </div>
      {!sent && open ? (
        confirm ? (
          <div className="space-y-2 rounded-[16px] bg-gold/20 p-3">
            <p className="text-[13px] text-ink">Iedereen krijgt een melding en Baddy zet het in de squadchat. Dit kan maar één keer.</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={sendAll} loading={pending}>
                Ja, verstuur
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirm(false)} disabled={pending}>
                Annuleer
              </Button>
            </div>
          </div>
        ) : (
          <Button className="w-full" onClick={() => setConfirm(true)} disabled={pending}>
            Verstuur naar iedereen
          </Button>
        )
      ) : null}
      {note ? (
        <p className={note.error ? "text-[12.5px] text-danger" : "text-[12.5px] text-ink"} role={note.error ? "alert" : "status"}>
          {note.text}
        </p>
      ) : null}
    </div>
  );
}
