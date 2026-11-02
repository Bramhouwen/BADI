import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { requireContext } from "@/lib/data";
import { todayKey } from "@/lib/dates";
import { loadChatList, loadPeople } from "@/lib/chat-data";
import { RealtimeRefresher } from "@/components/app/realtime-refresher";
import { ChatList } from "../chat-list";

/** On wide screens the chat list stays next to the open conversation. */
async function Sidebar() {
  const ctx = await requireContext();
  const people = await loadPeople(ctx);
  const items = await loadChatList(ctx, people);
  return (
    <>
      <RealtimeRefresher channel={`chat-sidebar:${ctx.challenge.id}`} tables={["squad_messages", "direct_reads"]} />
      <ChatList items={items} people={people} me={ctx.userId} today={todayKey(new Date(), ctx.challenge.timezone)} tz={ctx.challenge.timezone} />
    </>
  );
}

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[320px] overflow-y-auto border-r border-ink/[0.07] bg-[#f3e7de] px-2 pb-6 md:block" style={{ paddingTop: "calc(var(--sat) + 12px)" }} aria-label="Chats">
        <div className="mb-3 flex items-center justify-between px-2.5">
          <Link href="/" aria-label="BADI home">
            <Image src="/brand/wordmark-tagline-dark.png" alt="BADI" width={84} height={29} className="h-[24px] w-auto" />
          </Link>
          <Link href="/squad" className="text-[12.5px] font-medium text-muted hover:text-ink">
            Squad
          </Link>
        </div>
        <h2 className="mb-1 px-2.5 font-display text-[22px]">Chats</h2>
        <Suspense fallback={<div className="h-64 animate-pulse rounded-[18px] bg-white/50" />}>
          <Sidebar />
        </Suspense>
      </aside>
      <div className="md:pl-[320px]">{children}</div>
    </>
  );
}
