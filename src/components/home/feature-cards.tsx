import Link from "next/link";
import { ArrowRight, Camera, ChefHat, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

function FeatureCard({ href, tone, icon: Icon, title, body }: { href: string; tone: "blush" | "sage"; icon: typeof ChefHat; title: string; body: string }) {
  return (
    <Link
      href={href}
      className={cn("relative flex min-h-[124px] flex-col justify-between rounded-[20px] p-4 pb-3.5 shadow-[0_8px_24px_-20px_rgba(110,64,52,0.4)] transition active:scale-[0.99]", tone === "blush" ? "bg-gradient-to-br from-[#eddccd] to-[#e3cbb9]" : "bg-gradient-to-br from-[#d9dec8] to-[#cbd3b8]")}
    >
      <Icon size={22} strokeWidth={1.5} className="text-ink" aria-hidden />
      <div>
        <p className="font-display text-[18px] leading-tight text-text">{title}</p>
        <p className="mt-0.5 pr-9 text-[11.5px] leading-snug text-ink/70">{body}</p>
      </div>
      <span className="absolute bottom-3.5 right-3.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/75 text-ink shadow-sm" aria-hidden>
        <ArrowRight size={13} strokeWidth={1.8} />
      </span>
    </Link>
  );
}

export function FeatureCards() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <FeatureCard href="/kitchen" tone="blush" icon={ChefHat} title="Kitchen" body="Deel een gezond recept met de squad" />
      <FeatureCard href="/wall" tone="sage" icon={Camera} title="The Wall" body="Plaats een foto van je moment" />
    </div>
  );
}

export function SquadRow({ members }: { members: { id: string; name: string; avatar: string | null; checkedInToday: boolean }[] }) {
  const done = members.filter((m) => m.checkedInToday).length;
  return (
    <Link href="/squad" className="glass flex items-center gap-3 rounded-[20px] px-3 py-2.5 pr-3.5">
      <div className="flex -space-x-3">
        {members.slice(0, 4).map((m) => (
          <Avatar key={m.id} name={m.name} src={m.avatar} size="md" className="h-9 w-9 text-xs ring-2 ring-[#fdf8f4]" />
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display text-[17px] leading-tight text-text">Jouw squad</p>
        <p className="text-[11.5px] text-muted">
          {done} van {members.length} vandaag ingecheckt · geen ranking
        </p>
      </div>
      <span className="soft flex h-8 w-8 items-center justify-center rounded-full" aria-hidden>
        <Users size={15} strokeWidth={1.6} />
      </span>
    </Link>
  );
}
