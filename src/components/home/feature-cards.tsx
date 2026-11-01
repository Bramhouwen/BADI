import Link from "next/link";
import { ArrowRight, Camera, ChefHat, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

function FeatureCard({ href, tone, icon: Icon, title, body }: { href: string; tone: "blush" | "sage"; icon: typeof ChefHat; title: string; body: string }) {
  return (
    <Link
      href={href}
      className={cn("relative flex min-h-[150px] flex-col justify-between rounded-[22px] p-4 shadow-[0_10px_30px_-22px_rgba(110,64,52,0.35)] transition active:scale-[0.99]", tone === "blush" ? "bg-sand" : "bg-sage-card")}
    >
      <Icon size={26} strokeWidth={1.4} className="text-ink" aria-hidden />
      <div>
        <p className="font-display text-[19px] leading-tight text-text">{title}</p>
        <p className="mt-1 pr-9 text-[12px] leading-snug text-muted">{body}</p>
      </div>
      <span className="absolute bottom-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-ink" aria-hidden>
        <ArrowRight size={14} strokeWidth={1.8} />
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
    <Link href="/squad" className="glass flex items-center gap-3 rounded-[22px] p-3 pr-4">
      <div className="flex -space-x-3">
        {members.slice(0, 4).map((m) => (
          <Avatar key={m.id} name={m.name} src={m.avatar} size="md" className="h-11 w-11 ring-2 ring-[#fffaf6]" />
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display text-[18px] leading-tight text-text">Jouw squad</p>
        <p className="text-[12px] text-muted">
          {done} van {members.length} vandaag ingecheckt · geen ranking
        </p>
      </div>
      <span className="soft flex h-9 w-9 items-center justify-center rounded-full" aria-hidden>
        <Users size={16} strokeWidth={1.6} />
      </span>
    </Link>
  );
}
