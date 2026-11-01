"use client";

import { useState } from "react";
import { HandHeart } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { firstName } from "@/lib/utils";
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

export function SquadMemberCard({ member }: { member: SquadCardMember }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col rounded-[20px] border border-border/70 bg-card p-4">
      <div className="flex items-center gap-3">
        <Avatar name={member.name} src={member.avatar} size="lg" ring={member.checkedInToday} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold">
            {firstName(member.name)}
            {member.isMe ? <span className="text-sm font-normal text-muted"> (jij)</span> : null}
          </p>
          <p className="text-sm text-warm">🔥 {member.streak} {member.streak === 1 ? "dag" : "dagen"} streak</p>
          <p className="text-xs text-muted">{member.total} {member.total === 1 ? "dag" : "dagen"} voltooid</p>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 text-xs text-muted">
        {member.latestActivity ? (
          <>
            {member.latestActivity} <span className="text-muted/70">· {member.latestAt ? relativeTimeNl(member.latestAt) : ""}</span>
          </>
        ) : (
          "Nog geen activiteit gedeeld."
        )}
      </p>
      {!member.isMe ? (
        <>
          <Button variant="secondary" size="sm" className="mt-3 w-full" onClick={() => setOpen(true)}>
            <HandHeart className="h-4 w-4 text-ice" /> Geef compliment
          </Button>
          <ComplimentSheet open={open} onClose={() => setOpen(false)} receiver={{ id: member.id, name: firstName(member.name) }} />
        </>
      ) : (
        <p className="mt-3 rounded-xl bg-bg-2 py-2 text-center text-xs text-muted">Dit ben jij ❄️</p>
      )}
    </div>
  );
}
