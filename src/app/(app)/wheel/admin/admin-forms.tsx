"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePrize, saveBudget, savePrize, saveWeights, setGiftCode, setSpinStatus } from "@/app/actions/wheel";
import { Button } from "@/components/ui/button";
import { ImagePicker } from "@/components/app/image-picker";
import { CATEGORY_META, PRIZE_CATEGORIES, WHEEL_CATEGORIES, formatChance, type WheelCategory } from "@/lib/wheel";
import { cn } from "@/lib/utils";

const input = "h-11 w-full rounded-[14px] bg-white px-3.5 text-[14px] text-text ring-1 ring-ink/12 outline-none focus:ring-2 focus:ring-water-deep";

function Message({ error, saved }: { error: string | null; saved?: string | null }) {
  if (error)
    return (
      <p className="text-[12.5px] text-danger" role="alert">
        {error}
      </p>
    );
  if (saved)
    return (
      <p className="text-[12.5px] text-ink" role="status">
        {saved}
      </p>
    );
  return null;
}

/** Weights per category; the chances shown are over all categories with a weight (the wheel itself leaves out empty ones). */
export function WeightsForm({ weights }: { weights: Record<WheelCategory, number> }) {
  const router = useRouter();
  const [values, setValues] = useState(weights);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const total = WHEEL_CATEGORIES.reduce((a, k) => a + (Number.isFinite(values[k]) ? values[k] : 0), 0);
  return (
    <form
      className="space-y-3"
      action={(fd) =>
        start(async () => {
          setError(null);
          setSaved(null);
          const res = await saveWeights(fd);
          if (!res.ok) setError(res.error);
          else {
            setSaved("Kansen opgeslagen.");
            router.refresh();
          }
        })
      }
    >
      <ul className="space-y-2">
        {WHEEL_CATEGORIES.map((k) => (
          <li key={k} className="flex items-center gap-3">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: CATEGORY_META[k].color }} aria-hidden />
            <label htmlFor={`w-${k}`} className="min-w-0 flex-1 text-[13.5px] leading-tight text-text">
              {CATEGORY_META[k].label}
              <span className="block text-[11px] text-muted">{CATEGORY_META[k].band}</span>
            </label>
            <input
              id={`w-${k}`}
              name={k}
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              value={Number.isFinite(values[k]) ? values[k] : ""}
              onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value === "" ? NaN : Number(e.target.value) }))}
              className={cn(input, "w-20 text-right tabular-nums")}
            />
            <span className="w-14 text-right text-[12px] tabular-nums text-muted">{total > 0 && Number.isFinite(values[k]) ? formatChance(values[k] / total) : "-"}</span>
          </li>
        ))}
      </ul>
      <p className={cn("text-[11.5px] leading-snug", total === 100 ? "text-muted" : "text-danger")}>
        Totaal {Number.isFinite(total) ? total : "-"}%{total === 100 ? "" : ", hoort 100% te zijn"}. Een niveau zonder beschikbare prijs (uit, op, maximum per week of buiten budget) valt van het rad; de andere niveaus houden hun onderlinge verhouding.
      </p>
      <Message error={error} saved={saved} />
      <Button type="submit" size="sm" loading={pending}>
        Kansen opslaan
      </Button>
    </form>
  );
}

export interface PrizeFormValue {
  id: string;
  category: string;
  brand: string;
  name: string;
  description: string;
  value: string;
  url: string;
  image_path: string | null;
  image_url: string | null;
  variant_label: string;
  variants: string;
  needs_code: boolean;
  stock: number;
  weekly_max: string;
  weight: number;
  cost: string;
  sponsored: string;
  shipping: string;
  active: boolean;
}

export function PrizeForm({ value, pathPrefix }: { value: PrizeFormValue; pathPrefix: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [deleting, startDelete] = useTransition();
  return (
    <form
      className="space-y-4"
      action={(fd) =>
        start(async () => {
          setError(null);
          const res = await savePrize(fd);
          if (!res.ok) setError(res.error);
          else router.push("/wheel/admin#prijzen");
        })
      }
    >
      <input type="hidden" name="id" value={value.id} />
      <ImagePicker bucket="prizes" pathPrefix={pathPrefix} initialPath={value.image_path} initialUrl={value.image_url} label="Productfoto" />
      <p className="-mt-2 text-[11.5px] leading-snug text-muted">Vierkant, product in het midden op een rustige lichte achtergrond.</p>
      <div className="grid grid-cols-2 gap-3">
        <label className="col-span-2 block">
          <span className="mb-1 block text-[12.5px] text-muted">Categorie</span>
          <select name="category" defaultValue={value.category} className={input}>
            {PRIZE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_META[c].label} ({CATEGORY_META[c].band})
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[12.5px] text-muted">Merk</span>
          <input name="brand" defaultValue={value.brand} required maxLength={60} className={input} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12.5px] text-muted">Product</span>
          <input name="name" defaultValue={value.name} required maxLength={80} className={input} />
        </label>
        <label className="col-span-2 block">
          <span className="mb-1 block text-[12.5px] text-muted">Introductie voor de winnaar</span>
          <textarea name="description" defaultValue={value.description} maxLength={600} rows={4} placeholder="Wie is het merk en wat krijg je precies?" className={cn(input, "h-auto py-2.5")} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12.5px] text-muted">Winkelwaarde (€)</span>
          <input name="value" inputMode="decimal" defaultValue={value.value} placeholder="Bijv. 25" className={input} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12.5px] text-muted">Website</span>
          <input name="url" type="url" inputMode="url" defaultValue={value.url} placeholder="https://" maxLength={300} className={input} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12.5px] text-muted">Keuze heet</span>
          <input name="variant_label" defaultValue={value.variant_label} placeholder="Maat, Smaak, Kleur" maxLength={30} className={input} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12.5px] text-muted">Opties (komma)</span>
          <input name="variants" defaultValue={value.variants} placeholder="S, M, L" maxLength={400} className={input} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12.5px] text-muted">Voorraad</span>
          <input name="stock" type="number" inputMode="numeric" min={0} defaultValue={value.stock} className={input} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12.5px] text-muted">Max per week</span>
          <input name="weekly_max" type="number" inputMode="numeric" min={1} defaultValue={value.weekly_max} placeholder="Geen" className={input} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12.5px] text-muted">Gewicht in niveau</span>
          <input name="weight" type="number" inputMode="numeric" min={1} max={100} defaultValue={value.weight} className={input} />
        </label>
        <p className="col-span-2 -mt-1 text-[11.5px] leading-snug text-muted">Gewicht: hoe vaak dit product valt ten opzichte van de andere in hetzelfde niveau. 30 valt drie keer zo vaak als 10.</p>
        <label className="block">
          <span className="mb-1 block text-[12.5px] text-muted">Inkoopprijs (€)</span>
          <input name="cost" inputMode="decimal" defaultValue={value.cost} placeholder="0,00" className={input} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12.5px] text-muted">Gesponsord (€)</span>
          <input name="sponsored" inputMode="decimal" defaultValue={value.sponsored} placeholder="0,00" className={input} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12.5px] text-muted">Verzendkosten (€)</span>
          <input name="shipping" inputMode="decimal" defaultValue={value.shipping} placeholder="0,00" className={input} />
        </label>
        <p className="col-span-2 -mt-1 text-[11.5px] leading-snug text-muted">Kosten per uitgereikte prijs = inkoop + verzending - gesponsord. Dat telt mee voor het budget. Winkelwaarde, inkoop en kosten ziet alleen jij.</p>
      </div>
      <label className="flex items-center gap-3 text-[13.5px] text-text">
        <input type="checkbox" name="needs_code" defaultChecked={value.needs_code} className="h-5 w-5 accent-[#6e4034]" />
        Cadeaubon met code (je vult de code in bij de claim)
      </label>
      <label className="flex items-center gap-3 text-[13.5px] text-text">
        <input type="checkbox" name="active" defaultChecked={value.active} className="h-5 w-5 accent-[#6e4034]" />
        Actief: kan gewonnen worden zolang er voorraad is
      </label>
      <Message error={error} />
      <div className="flex items-center gap-2">
        <Button type="submit" loading={pending} className="flex-1">
          Opslaan
        </Button>
        {value.id ? (
          <Button
            type="button"
            variant="danger"
            loading={deleting}
            onClick={() => {
              if (!confirm("Deze prijs verwijderen? Gewonnen exemplaren blijven in de prijzenkast staan.")) return;
              startDelete(async () => {
                const res = await deletePrize(value.id);
                if (!res.ok) setError(res.error);
                else router.push("/wheel/admin#prijzen");
              });
            }}
          >
            Verwijderen
          </Button>
        ) : null}
      </div>
    </form>
  );
}

/** One claim: move it to ordered or handed over, and add a gift card code. */
export function ClaimControls({ spinId, status, needsCode, code }: { spinId: string; status: string; needsCode: boolean; code: string | null }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [codeValue, setCodeValue] = useState(code ?? "");
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Opslaan lukte niet.");
      else router.refresh();
    });
  return (
    <div className="mt-2.5 space-y-2">
      <div className="flex flex-wrap gap-2">
        {status !== "ordered" && status !== "delivered" ? (
          <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => run(() => setSpinStatus(spinId, "ordered"))}>
            Besteld
          </Button>
        ) : null}
        {status !== "delivered" ? (
          <Button type="button" size="sm" disabled={pending} onClick={() => run(() => setSpinStatus(spinId, "delivered"))}>
            Overhandigd
          </Button>
        ) : (
          <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setSpinStatus(spinId, "claimed"))}>
            Terugzetten
          </Button>
        )}
      </div>
      {needsCode ? (
        <div className="flex gap-2">
          <input value={codeValue} onChange={(e) => setCodeValue(e.target.value)} placeholder="Cadeaucode" maxLength={120} aria-label="Cadeaucode" className={cn(input, "h-10 font-mono text-[13px]")} />
          <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => run(() => setGiftCode(spinId, codeValue))}>
            Code opslaan
          </Button>
        </div>
      ) : null}
      <Message error={error} />
    </div>
  );
}

/** Prize budget per week or month; empty means no budget limit. */
export function BudgetForm({ budget, period }: { budget: string; period: "week" | "month" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-3"
      action={(fd) =>
        start(async () => {
          setError(null);
          setSaved(null);
          const res = await saveBudget(fd);
          if (!res.ok) setError(res.error);
          else {
            setSaved("Budget opgeslagen.");
            router.refresh();
          }
        })
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-[12.5px] text-muted">Budget (€)</span>
          <input name="budget" inputMode="decimal" defaultValue={budget} placeholder="Geen limiet" className={input} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12.5px] text-muted">Per</span>
          <select name="period" defaultValue={period} className={input}>
            <option value="week">Week</option>
            <option value="month">Maand</option>
          </select>
        </label>
      </div>
      <Message error={error} saved={saved} />
      <Button type="submit" size="sm" loading={pending}>
        Budget opslaan
      </Button>
    </form>
  );
}
