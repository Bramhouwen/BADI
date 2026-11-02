"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { listTime, typingLabel } from "@/lib/conversations";
import { useTyping } from "@/lib/presence";
import type { ChatListItem, ChatPerson } from "@/lib/chat-data";
import { cn } from "@/lib/utils";

function GroupAvatar({ people, me }: { people: ChatPerson[]; me: string }) {
  const shown = [...people.filter((p) => p.id !== me), ...people.filter((p) => p.id === me)].slice(0, 4);
  return (
    <span className="grid h-[52px] w-[52px] shrink-0 grid-cols-2 gap-[2px] overflow-hidden rounded-full bg-white p-[3px] ring-1 ring-ink/[0.06]" aria-hidden>
      {shown.map((p) => (
        <Avatar key={p.id} name={p.name} src={p.avatar} size="xs" className="h-full w-full rounded-full text-[9px] ring-0" />
      ))}
    </span>
  );
}

function Row({ item, people, me, today, tz, active }: { item: ChatListItem; people: ChatPerson[]; me: string; today: string; tz: string; active: boolean }) {
  const typingIds = useTyping(item.key === "baddy" ? "none" : item.key);
  const names = typingIds.filter((id) => id !== me).map((id) => people.find((p) => p.id === id)?.firstName ?? "Iemand");
  const typing = item.key === "squad" ? typingLabel(names) : names.length ? "typt…" : null;
  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn("flex items-center gap-3 rounded-[18px] px-2.5 py-2.5 transition hover:bg-white/70", active && "bg-white shadow-sm")}
      >
        {item.key === "squad" ? (
          <GroupAvatar people={people} me={me} />
        ) : item.userId ? (
          <MemberAvatar userId={item.userId} name={item.title} src={item.avatar} size={46} />
        ) : (
          <Avatar name={item.title} src={item.avatar} size="md" className="h-[52px] w-[52px] ring-2 ring-sage/40" />
        )}
        <span className="min-w-0 flex-1 border-b border-ink/[0.06] pb-2.5 pt-0.5">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[15.5px] font-semibold text-text">{item.title}</span>
            {item.at ? <span className={cn("shrink-0 text-[11.5px] tabular-nums", item.unread ? "font-semibold text-sage" : "text-muted")}>{listTime(item.at, today, tz)}</span> : null}
          </span>
          <span className="mt-0.5 flex items-center justify-between gap-2">
            <span className={cn("truncate text-[13px]", typing ? "font-medium text-sage" : item.unread ? "text-ink" : "text-muted")}>{typing ?? item.preview ?? "Nog geen berichten"}</span>
            {item.unread ? (
              <span className="flex h-[20px] min-w-[20px] shrink-0 items-center justify-center rounded-full bg-sage px-1.5 text-[11px] font-semibold tabular-nums text-white" aria-label={`${item.unread} ongelezen`}>
                {item.unread > 99 ? "99+" : item.unread}
              </span>
            ) : null}
          </span>
        </span>
      </Link>
    </li>
  );
}

/** WhatsApp-style chat list: the squad group, private chats with each member and Baddy. */
export function ChatList({ items, people, me, today, tz }: { items: ChatListItem[]; people: ChatPerson[]; me: string; today: string; tz: string }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-0.5">
      {items.map((item) => (
        <Row key={item.key} item={item} people={people} me={me} today={today} tz={tz} active={pathname === item.href} />
      ))}
    </ul>
  );
}
