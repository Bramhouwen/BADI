"use client";

import { useState, useTransition } from "react";
import { Copy, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import { ErrorText, Hint, Input, Label } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { createInvitation, revokeInvitation } from "@/app/actions/group";
import { formatDateTimeNl } from "@/lib/dates";

export function InviteManager({ spots, open }: { spots: number; open: { id: string; invited_email: string | null; expires_at: string }[] }) {
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast("Link gekopieerd", "success");
    } catch {
      toast("Kopiëren lukte niet, selecteer de link handmatig.", "error");
    }
  }

  async function share() {
    if (!link) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Winter Arc", text: "Doe je mee met onze Winter Arc? ❄️", url: link });
      } catch {
        /* cancelled */
      }
    } else copy();
  }

  return (
    <>
      <section>
        <SectionTitle>Nieuwe uitnodiging</SectionTitle>
        <Card className="space-y-4">
          {spots <= 0 ? (
            <p className="text-sm text-muted">De squad is compleet. Winter Arc is voor precies vier vrienden.</p>
          ) : (
            <form
              className="space-y-3"
              action={(fd) => {
                setError(null);
                start(async () => {
                  const r = await createInvitation(fd);
                  if (!r.ok) setError(r.error);
                  else setLink(r.data!.url);
                });
              }}
            >
              <div>
                <Label htmlFor="email">E-mailadres (optioneel)</Label>
                <Input id="email" name="email" type="email" inputMode="email" placeholder="vriend@voorbeeld.nl" />
                <Hint>Vul je een e-mailadres in, dan werkt de link alleen voor dat adres. Links zijn eenmalig en 7 dagen geldig.</Hint>
              </div>
              <Button type="submit" className="w-full" loading={pending}>
                Maak uitnodigingslink
              </Button>
            </form>
          )}
          {link ? (
            <div className="space-y-2 rounded-2xl border border-ice/40 bg-bg-2 p-3">
              <p className="text-xs font-semibold text-ice">Deel deze link (wordt maar één keer getoond)</p>
              <p className="break-all text-xs text-text/90">{link}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={copy}>
                  <Copy className="h-4 w-4" /> Kopieer
                </Button>
                <Button size="sm" variant="secondary" onClick={share}>
                  <Share2 className="h-4 w-4" /> Deel
                </Button>
              </div>
            </div>
          ) : null}
          <ErrorText>{error}</ErrorText>
        </Card>
      </section>

      {open.length > 0 ? (
        <section>
          <SectionTitle>Openstaande uitnodigingen</SectionTitle>
          <Card className="divide-y divide-border/60 p-0">
            {open.map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{i.invited_email ?? "Open link (ieder e-mailadres)"}</p>
                  <p className="text-xs text-muted">Verloopt {formatDateTimeNl(i.expires_at)}</p>
                </div>
                <form action={(fd) => start(async () => { const r = await revokeInvitation(fd); if (!r.ok) toast(r.error, "error"); else toast("Uitnodiging ingetrokken"); })}>
                  <input type="hidden" name="id" value={i.id} />
                  <button type="submit" className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:text-danger" aria-label="Intrekken" disabled={pending}>
                    <X className="h-4 w-4" />
                  </button>
                </form>
              </div>
            ))}
          </Card>
        </section>
      ) : null}
    </>
  );
}
