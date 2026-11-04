import Link from "next/link";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { SuperBadiBanner } from "@/components/ui/super-badi";
import { GOLD } from "@/lib/super-badi";
import { firstName } from "@/lib/utils";

/** Spotlight on Home: the Super Badi in gold on a dark card, with streak and week points. */
export function SuperBadiCard({ members }: { members: { id: string; name: string; avatar: string | null; streak: number; weekPoints: number; week: number; isMe: boolean }[] }) {
  const lead = members[0];
  if (!lead) return null;
  const names = members.map((m) => (m.isMe ? "Jij" : firstName(m.name)));
  return (
    <Link
      href={`/squad/${lead.id}`}
      className="relative mb-3 flex items-center gap-4 overflow-hidden rounded-[24px] bg-[#1a110e] px-4 pb-4 pt-6"
      style={{ backgroundImage: "radial-gradient(120% 90% at 22% 40%, rgba(217,166,60,0.22), transparent 60%)" }}
      aria-label={`Super Badi: ${names.join(" en ")}`}
    >
      <MemberAvatar userId={lead.id} name={lead.name} src={lead.avatar} size={64} progress={lead.week} crown className="ml-2" />
      <div className="min-w-0 flex-1">
        <SuperBadiBanner />
        <p className="mt-2 truncate font-display text-[24px] leading-none" style={{ color: GOLD.light }}>
          {names.join(" en ")}
        </p>
        <p className="mt-1.5 text-[12px] text-white/70">
          {lead.streak} {lead.streak === 1 ? "dag" : "dagen"} op rij · {lead.weekPoints} weekpunten
        </p>
      </div>
    </Link>
  );
}
