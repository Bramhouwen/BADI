import { Suspense } from "react";
import Link from "next/link";
import { requireContext } from "@/lib/data";
import { Page, PageTitle } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Fab } from "@/components/app/fab";
import { RealtimeRefresher } from "@/components/app/realtime-refresher";
import { PostCard } from "./post-card";
import { loadPosts } from "./wall-data";
import { PostedToast } from "./posted-toast";

export const metadata = { title: "The Wall" };

async function Content() {
  const ctx = await requireContext();
  const posts = await loadPosts(ctx, { limit: 60 });
  return (
    <Page>
      <RealtimeRefresher channel={`wall:${ctx.challenge.id}`} tables={["wall_posts", "post_reactions"]} />
      <PostedToast />
      <PageTitle title="The Wall 📸" subtitle="Jullie momenten. Alleen zichtbaar voor de squad." />
      {posts.length === 0 ? (
        <EmptyState
          emoji="📸"
          title="Nog geen momenten"
          body="Een gymfoto, een wandeling, een gezonde maaltijd of gewoon een mooi uitzicht. Alles telt."
          action={
            <Link href="/wall/new">
              <Button>Eerste foto plaatsen</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}
      <Fab href="/wall/new" label="Foto plaatsen" />
    </Page>
  );
}

export default function WallPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}
