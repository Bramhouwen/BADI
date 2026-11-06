import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireContext } from "@/lib/data";
import { loadPrizes } from "@/lib/wheel-server";
import { signedUrl } from "@/lib/storage";
import { Page, PageTitle } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/skeleton";
import { PrizeForm, type PrizeFormValue } from "../../admin-forms";

export const metadata = { title: "Prijs" };

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();
  if (ctx.membership.role !== "admin") notFound();
  const prize = id === "new" ? null : (await loadPrizes(ctx.challenge.id)).find((p) => p.id === id);
  if (id !== "new" && !prize) notFound();
  const value: PrizeFormValue = prize
    ? {
        id: prize.id,
        category: prize.category,
        brand: prize.brand,
        name: prize.name,
        description: prize.description ?? "",
        image_path: prize.image_path,
        image_url: await signedUrl("prizes", prize.image_path),
        variant_label: prize.variant_label ?? "",
        variants: prize.variants.join(", "),
        needs_code: prize.needs_code,
        stock: prize.stock,
        weekly_max: prize.weekly_max === null ? "" : String(prize.weekly_max),
        cost: prize.cost_cents ? (prize.cost_cents / 100).toLocaleString("nl-NL", { minimumFractionDigits: 2 }) : "",
        active: prize.active,
      }
    : { id: "", category: "food", brand: "", name: "", description: "", image_path: null, image_url: null, variant_label: "", variants: "", needs_code: false, stock: 1, weekly_max: "", cost: "", active: true };
  return (
    <Page>
      <PageTitle title={prize ? `${prize.brand}: ${prize.name}` : "Nieuwe prijs"} back="/wheel/admin#prijzen" />
      <PrizeForm value={value} pathPrefix={`${ctx.challenge.id}/${ctx.userId}`} />
    </Page>
  );
}

export default function PrizeEditPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content params={params} />
    </Suspense>
  );
}
