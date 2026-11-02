import { Page, PageTitle } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
import { PRINCIPLES } from "@/lib/constants";
import { IconBadge } from "@/components/ui/icon-badge";
import { Dumbbell, Droplets, Egg, Footprints, Moon, Salad, Wine, type LucideIcon } from "lucide-react";

const ICONS: LucideIcon[] = [Salad, Dumbbell, Footprints, Egg, Moon, Droplets, Wine];

export const metadata = { title: "De zeven principes" };

export default function PrinciplesPage() {
  return (
    <Page className="space-y-4">
      <PageTitle title="De zeven principes" subtitle="Richtlijnen voor de challenge." back="/profile" />
      <ol className="space-y-3">
        {PRINCIPLES.map((p, i) => (
          <li key={p.title}>
            <Card className="flex gap-4">
              <IconBadge icon={ICONS[i] ?? Salad} size="lg" />
              <div>
                <p className="text-[11px] font-medium tracking-[0.18em] text-muted">PRINCIPE {i + 1}</p>
                <h2 className="font-display text-[19px] text-text">{p.title}</h2>
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
