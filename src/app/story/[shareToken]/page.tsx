import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { AppPageFallback } from "@/components/app/app-page-fallback";
import { PublicStoryReader } from "@/components/stories/public-story-reader";
import { loadStoryByShareToken } from "@/lib/stories/load-by-share";

async function PublicShareStoryInner({ shareToken }: { shareToken: string }) {
  await connection();
  const story = await loadStoryByShareToken(shareToken);
  if (!story) notFound();

  return (
    <PublicStoryReader
      title={story.title}
      pages={story.pages}
      shareToken={story.shareToken || shareToken}
      storyId={story.id}
    />
  );
}

async function PublicShareStoryBridge({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}) {
  const { shareToken } = await params;
  return <PublicShareStoryInner shareToken={shareToken} />;
}

export default function PublicShareStoryPage({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}) {
  return (
    <Suspense fallback={<AppPageFallback label="Carregando história…" />}>
      <PublicShareStoryBridge params={params} />
    </Suspense>
  );
}
