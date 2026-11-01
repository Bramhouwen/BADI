import { Page, PageTitle } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
import { PRINCIPLES } from "@/lib/constants";

export const metadata = { title: "De zeven principes" };

export default function PrinciplesPage() {
  return (
    <Page className="space-y-4">
      <PageTitle title="De zeven principes" subtitle="Richtlijnen, geen regels. Balans boven perfectie." back="/profile" />
      <ol className="space-y-3">
        {PRINCIPLES.map((p, i) => (
          <li key={p.title}>
            <Card className="flex gap-4">
              <span className="tile flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-2xl" aria-hidden>
                {p.emoji}
              </span>
              <div>
                <p className="text-[11px] font-semibold tracking-[0.18em] text-water-deep">PRINCIPE {i + 1}</p>
                <h2 className="text-base font-semibold">{p.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted">{p.body}</p>
              </div>
            </Card>
          </li>
        ))}
      </ol>
      <p className="px-2 text-center text-xs text-muted">
        Show up for yourself. Inspire the others. Grow together. Dit is geen wedstrijd: er is geen ranking, geen verliezer en geen druk om perfect te zijn.
      </p>
    </Page>
  );
}
