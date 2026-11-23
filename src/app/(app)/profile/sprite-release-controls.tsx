"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { releaseSprite, sendSpriteTest } from "@/app/actions/sprites";
import { OWN_SPRITE_PREVIEW } from "@/lib/announcement";
import { formatDateNl } from "@/lib/dates";

export interface SpriteRow {
  key: string;
  name: string;
  face: string;
  /** Squad member with this first name, if any. */
  memberFound: boolean;
  releasedAt: string | null;
}

function Row({ row }: { row: SpriteRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);

  function test() {
    setNote(null);
    start(async () => {
      const res = await sendSpriteTest(row.key);
      setNote(res.ok ? { text: `Test-melding verstuurd. Tik erop om te zien wat ${row.name} krijgt.`, error: false } : { text: res.error, error: true });
    });
  }

  function release() {
    setNote(null);
    start(async () => {
      const res = await releaseSprite(row.key);
      setConfirm(false);
      setNote(res.ok ? { text: `Vrijgegeven. ${row.name} krijgt een melding en ziet het poppetje bij het openen van de app.`, error: false } : { text: res.error, error: true });
      if (res.ok) router.refresh();
    });
  }

  return (
    <li className="glass space-y-3 rounded-[22px] p-4">
      <div className="flex items-center gap-3">
        <Image src={row.face} alt="" width={96} height={96} className="h-12 w-12 rounded-full ring-2 ring-white" />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium text-text">{row.name}</p>
          <p className="text-[12.5px] text-muted">
            {row.releasedAt
              ? `Vrijgegeven op ${formatDateNl(row.releasedAt.slice(0, 10), { day: "numeric", month: "long" })}`
              : row.memberFound
                ? "Klaar, nog niet vrijgegeven"
                : `Geen lid met de voornaam ${row.name}`}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href={`/?${OWN_SPRITE_PREVIEW}=${row.key}`}>
          <Button variant="secondary" size="sm">Bekijk hier</Button>
        </Link>
        {!row.releasedAt ? (
          <Button variant="secondary" size="sm" onClick={test} loading={pending && !confirm}>
            Test-melding naar mij
          </Button>
        ) : null}
      </div>
      {!row.releasedAt && row.memberFound ? (
        confirm ? (
          <div className="space-y-2 rounded-[16px] bg-gold/20 p-3">
            <p className="text-[13px] text-ink">{row.name} krijgt een melding en ziet het poppetje bij het openen van de app. Dit kan maar één keer.</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={release} loading={pending}>
                Ja, geef vrij
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirm(false)} disabled={pending}>
                Annuleer
              </Button>
            </div>
          </div>
        ) : (
          <Button className="w-full" onClick={() => setConfirm(true)} disabled={pending}>
            Geef {row.name} het poppetje
          </Button>
        )
      ) : null}
      {note ? (
        <p className={note.error ? "text-[12.5px] text-danger" : "text-[12.5px] text-ink"} role={note.error ? "alert" : "status"}>
          {note.text}
        </p>
      ) : null}
    </li>
  );
}

/** Admin only: characters that are ready, to preview, test and release one by one. */
export function SpriteReleaseControls({ rows }: { rows: SpriteRow[] }) {
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <Row key={r.key} row={r} />
      ))}
    </ul>
  );
}
