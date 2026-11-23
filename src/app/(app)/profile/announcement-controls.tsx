"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { sendAnnouncement, sendAnnouncementTest } from "@/app/actions/announcement";
import { ANNOUNCEMENT, ANNOUNCEMENT_PREVIEW } from "@/lib/announcement";

/** Admin only: preview the announcement, send a test push to yourself, then send it to the squad. */
export function AnnouncementControls({ sent }: { sent: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);

  function test() {
    setNote(null);
    start(async () => {
      const res = await sendAnnouncementTest();
      setNote(res.ok ? { text: `Test-melding verstuurd naar ${res.data?.devices ?? 1} ${res.data?.devices === 1 ? "toestel" : "toestellen"} van jou. Tik erop om Anne te zien.`, error: false } : { text: res.error, error: true });
    });
  }

  function sendAll() {
    setNote(null);
    start(async () => {
      const res = await sendAnnouncement();
      setConfirm(false);
      setNote(res.ok ? { text: "Verstuurd. Baddy heeft het in de squadchat gezet en iedereen krijgt een melding.", error: false } : { text: res.error, error: true });
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="glass space-y-3 rounded-[22px] p-4">
      <div>
        <p className="text-[14px] font-medium text-text">Anne stelt zich voor</p>
        <p className="mt-0.5 text-[12.5px] leading-snug text-muted">
          {sent ? "Verstuurd. Iedereen ziet Anne één keer als ze de app openen." : "Nog niet verstuurd. Alleen jij kunt het nu bekijken."}
        </p>
      </div>
      <blockquote className="rounded-[14px] bg-white/70 px-3 py-2 text-[12.5px] leading-snug text-text">
        <span className="font-medium">Melding:</span> {ANNOUNCEMENT.push.title} {ANNOUNCEMENT.push.body}
      </blockquote>
      <div className="flex flex-wrap gap-2">
        <Link href={`/?${ANNOUNCEMENT_PREVIEW}=1`}>
          <Button variant="secondary" size="sm">Bekijk hier</Button>
        </Link>
        {!sent ? (
          <Button variant="secondary" size="sm" onClick={test} loading={pending && !confirm}>
            Test-melding naar mij
          </Button>
        ) : null}
      </div>
      {!sent ? (
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
