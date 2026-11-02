import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PageSkeleton } from "@/components/ui/skeleton";
import { ThreadPage } from "../thread-page";

export const metadata = { title: "Chat" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function Content({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  if (!UUID.test(userId)) notFound();
  return <ThreadPage peerId={userId} />;
}

export default function DirectChatPage({ params }: { params: Promise<{ userId: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content params={params} />
    </Suspense>
  );
}
