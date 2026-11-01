import Link from "next/link";
import Image from "next/image";
import { EmptyState } from "@/components/ui/empty-state";

export interface InspirationItem {
  kind: "post" | "recipe";
  id: string;
  href: string;
  src: string | null;
  title: string;
  author: string;
}

export function InspirationPreview({ items }: { items: InspirationItem[] }) {
  if (items.length === 0) {
    return <EmptyState emoji="📸" title="Nog niets gedeeld" body="De eerste foto of het eerste recept van jullie squad verschijnt hier." />;
  }
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((it) => (
        <Link key={`${it.kind}-${it.id}`} href={it.href} className="group relative aspect-[4/5] overflow-hidden rounded-[18px] border border-border/70 bg-card">
          {it.src ? (
            <Image src={it.src} alt={it.title} fill sizes="(max-width: 512px) 50vw, 240px" className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" unoptimized />
          ) : null}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ice">{it.kind === "recipe" ? "Kitchen" : "Wall"}</p>
            <p className="line-clamp-1 text-sm font-semibold text-white">{it.title}</p>
            <p className="text-xs text-white/70">{it.author}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
