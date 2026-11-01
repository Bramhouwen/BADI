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
        <Link key={`${it.kind}-${it.id}`} href={it.href} className="group relative aspect-[4/5] overflow-hidden rounded-[24px] border border-ink/10 bg-white/70">
          {it.src ? (
            <Image src={it.src} alt={it.title} fill sizes="(max-width: 512px) 50vw, 240px" className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" unoptimized />
          ) : null}
          <span className="tile absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">{it.kind === "recipe" ? "Kitchen" : "Wall"}</span>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#2b1a14]/85 via-[#2b1a14]/35 to-transparent p-3 pt-10">
            <p className="line-clamp-1 text-[15px] font-semibold text-white">{it.title}</p>
            <p className="text-xs text-white/70">{it.author}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
