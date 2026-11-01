import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireContext } from "@/lib/data";
import { Page, PageTitle } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/skeleton";
import { PostCard } from "../post-card";
import { loadPosts } from "../wall-data";

export const metadata = { title: "Post" };

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();
  const [post] = await loadPosts(ctx, { id });
  if (!post) notFound();
  return (
    <Page>
      <PageTitle title="Moment" back="/wall" />
      <PostCard post={post} linkToDetail={false} />
    </Page>
  );
}

export default function PostPage({ params }: PageProps<"/wall/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content params={params} />
    </Suspense>
  );
}
