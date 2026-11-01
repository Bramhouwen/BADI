import { Suspense } from "react";
import { requireContext } from "@/lib/data";
import { Page, PageTitle } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/skeleton";
import { NewPostForm } from "./new-post-form";

export const metadata = { title: "Nieuwe post" };

async function Content() {
  const ctx = await requireContext();
  return (
    <Page>
      <PageTitle title="Deel een moment" subtitle="Een foto is verplicht, een bijschrift niet." back="/wall" />
      <NewPostForm pathPrefix={`${ctx.challenge.id}/${ctx.userId}`} />
    </Page>
  );
}

export default function NewPostPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}
