import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/skeleton";
import { ThreadPage } from "./thread-page";

export const metadata = { title: "The Squad" };

export default function GroupChatPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ThreadPage peerId={null} />
    </Suspense>
  );
}
