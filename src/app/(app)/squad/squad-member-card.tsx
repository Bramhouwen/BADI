"use client";

import { useState } from "react";
import { Check, HandHeart, Minus } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { firstName, cn } from "@/lib/utils";
import { relativeTimeNl } from "@/lib/dates";
import { ComplimentSheet } from "./compliment-sheet";

export interface SquadCardMember {
  id: string;
  name: string;
  avatar: string | null;
  streak: number;
  total: number;
  checkedInToday: boolean;
  latestActivity: string | null;
  latestAt: string | null;
  isMe: boolean;
}

function Stat({ value, label, tone }: { value: React.ReactNode; label: string; tone?: "sage" }) {
  return (
    <div className={cn("rounded-[14px] px-3 py-2.5 text-center", tone === "sage" ? "bg-sage/20" : "bg-blush/80")}>
      <div className="font-display text-[20px] leading-none text-text">{value}</div>
      <div className="mt-1 text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted">{label}</div>
    </div>
  );
}

export function SquadMemberCard({ member }: { member: SquadCardMember }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="glass rounded-[20px] p-4">
      <div className="flex items-center gap-3.5">
        <Avatar name={member.name} src={member.avatar} size="lg" ring={member.checkedInToday} className="h-16 w-16 text-lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[21px] leading-tight text-text">
            {firstName(member.name)}
            {member.isMe ? <span className="font-sans text-[13px] text-muted"> (jij)</span> : null}
          </p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-muted">
            {member.latestActivity ? (
              <>
                {member.latestActivity}
                {member.latestAt ? <span className="text-muted/70"> · {relativeTimeNl(member.latestAt)}</span> : null}
              </>
            ) : (
              "Nog geen activiteit gedeeld"
            )}
          </p>
        </div>
      </div>

      <div className="mt-3.5 grid grid-cols-3 gap-2">
        <Stat value={member.streak} label={member.streak === 1 ? "dag streak" : "dagen streak"} />
        <Stat value={member.total} label={member.total === 1 ? "dag voltooid" : "dagen voltooid"} />
        <Stat
          value={member.checkedInToday ? <Check className="mx-auto h-5 w-5 text-sage" strokeWidth={2.2} /> : <Minus className="mx-auto h-5 w-5 text-muted/60" strokeWidth={2} />}
          label="vandaag"
          tone={member.checkedInToday ? "sage" : undefined}
        />
      </div>

      {!member.isMe ? (
        <>
          <Button variant="primary" size="sm" className="mt-3.5 w-full" onClick={() => setOpen(true)}>
            <HandHeart className="h-4 w-4" strokeWidth={1.6} /> Geef compliment
          </Button>
          <ComplimentSheet open={open} onClose={() => setOpen(false)} receiver={{ id: member.id, name: firstName(member.name) }} />
        </>
      ) : null}
    </div>
  );
}
