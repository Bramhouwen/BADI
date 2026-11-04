import { Crown, Flame } from "lucide-react";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { firstName } from "@/lib/utils";
import { diffDays } from "@/lib/dates";
import { isMilestone } from "@/lib/streaks";

export interface SquadPreviewMember {
  id: string;
  name: string;
  avatar: string | null;
  streak: number;
  lastDate: string | null;
  checkedInToday: boolean;
  isMe: boolean;
  /** This week's progress, 0 to 1. */
  week: number;
  /** The most involved member right now (longest streak). */
  superBadi?: boolean;
}

function statusLabel(m: SquadPreviewMember, today: string): string {
  if (m.checkedInToday) return "Vandaag ingecheckt";
  if (!m.lastDate) return "Net begonnen";
  const d = diffDays(m.lastDate, today);
  if (d === 1) return "Gisteren actief";
  return `Laatst actief ${d} dagen geleden`;
}

export function SquadPreview({ members, today }: { members: SquadPreviewMember[]; today: string }) {
  return (
    <ul className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 pb-2">
      {members.map((m) => (
        <li key={m.id} className="glass w-[136px] shrink-0 rounded-[22px] p-3.5 pt-4">
          <MemberAvatar userId={m.id} name={m.name} src={m.avatar} size={46} progress={m.week} crown={m.superBadi} />
          <p className="mt-3 truncate text-[14px] font-medium text-text">
            {firstName(m.name)}
            {m.isMe ? <span className="font-normal text-muted"> (jij)</span> : null}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[12px] text-ink">
            <Flame size={13} strokeWidth={1.6} className="text-warm" /> {m.streak} {m.streak === 1 ? "dag" : "dagen"}
          </p>
          <p className="mt-1 truncate text-[11px] text-muted">{statusLabel(m, today)}</p>
          {m.superBadi ? (
            <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-[#a87a1e]">
              <Crown size={12} strokeWidth={2} /> Super Badi
            </p>
          ) : null}
          {isMilestone(m.streak) ? <p className="mt-1 text-[11px] font-medium text-sage">Mijlpaal: {m.streak} op rij</p> : null}
        </li>
      ))}
    </ul>
  );
}
