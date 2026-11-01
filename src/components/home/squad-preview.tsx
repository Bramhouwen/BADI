import { Avatar } from "@/components/ui/avatar";
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
    <ul className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
      {members.map((m) => (
        <li key={m.id} className="glass w-[140px] shrink-0 rounded-[24px] p-3.5">
          <Avatar name={m.name} src={m.avatar} size="md" ring={m.checkedInToday} className="h-14 w-14" />
          <p className="mt-3 truncate text-[15px] font-semibold">
            {firstName(m.name)}
            {m.isMe ? <span className="font-normal text-muted"> (jij)</span> : null}
          </p>
          <p className="text-[13px] font-medium text-warm">🔥 {m.streak} {m.streak === 1 ? "dag" : "dagen"}</p>
          <p className="mt-1 truncate text-[11px] text-muted">{statusLabel(m, today)}</p>
          {isMilestone(m.streak) ? <p className="mt-1 text-[11px] font-semibold text-gold">🏅 {m.streak} op rij</p> : null}
        </li>
      ))}
    </ul>
  );
}
