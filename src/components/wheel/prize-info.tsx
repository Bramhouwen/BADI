import { ExternalLink } from "lucide-react";
import { formatEuro, type WheelCategory } from "@/lib/wheel";
import { cn } from "@/lib/utils";

/** Value, introduction and website of a prize, for the reveal and the prize cabinet. */
export function PrizeInfo({ category, valueCents, description, url, center = false }: { category: WheelCategory; valueCents: number | null; description: string | null; url: string | null; center?: boolean }) {
  if (!valueCents && !description && !url) return null;
  let host = "";
  if (url) {
    try {
      host = new URL(url).hostname.replace(/^www\./, "");
    } catch {}
  }
  return (
    <div className={cn("space-y-2", center && "text-center")}>
      {valueCents ? (
        <p className={cn("w-fit rounded-full bg-gold/30 px-3 py-1 text-[12.5px] font-semibold text-ink", center && "mx-auto")}>
          {category === "voucher" ? "Tegoed" : "Waarde"} {formatEuro(valueCents)}
        </p>
      ) : null}
      {description ? <p className="whitespace-pre-line text-[13.5px] leading-snug text-text/80">{description}</p> : null}
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className={cn("inline-flex items-center gap-1.5 text-[13px] font-medium text-ink underline-offset-2 hover:underline", center && "justify-center")}>
          {host || "Website"}
          <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
          <span className="sr-only">(opent in een nieuw venster)</span>
        </a>
      ) : null}
    </div>
  );
}
