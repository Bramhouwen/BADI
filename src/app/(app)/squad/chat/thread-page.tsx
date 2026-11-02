import { notFound } from "next/navigation";
import { requireContext } from "@/lib/data";
import { todayKey } from "@/lib/dates";
import { BADDY_ID, type ChatMember } from "@/lib/chat";
import { loadPeople, loadShareables, loadThread } from "@/lib/chat-data";
import { ChatThread } from "./chat-thread";

/** Server part of a conversation page: the group chat (`peerId` null) or a private chat. */
export async function ThreadPage({ peerId }: { peerId: string | null }) {
  const ctx = await requireContext();
  const people = await loadPeople(ctx);
  const peer = peerId ? people.find((p) => p.id === peerId) : null;
  if (peerId && (!peer || peerId === ctx.userId)) notFound();
  const [thread, share] = await Promise.all([loadThread(ctx, people, peerId), loadShareables(ctx)]);
  const members: Record<string, ChatMember> = {
    ...Object.fromEntries(people.map((p) => [p.id, { name: p.firstName, avatar: p.avatar }])),
    [BADDY_ID]: { name: "Baddy", avatar: "/brand/baddy.jpg" },
  };
  return (
    <ChatThread
      key={peerId ?? "squad"}
      peer={peer ? { id: peer.id, name: peer.firstName, avatar: peer.avatar } : null}
      initial={thread.messages}
      hasMore={thread.hasMore}
      reactions={thread.reactions}
      peerLastRead={thread.peerLastRead}
      members={members}
      memberOrder={people.map((p) => p.id)}
      me={ctx.userId}
      challengeId={ctx.challenge.id}
      today={todayKey(new Date(), ctx.challenge.timezone)}
      tz={ctx.challenge.timezone}
      recipes={share.recipes}
      posts={share.posts}
      signed={thread.signed}
      mentionMembers={thread.mentionMembers}
    />
  );
}
