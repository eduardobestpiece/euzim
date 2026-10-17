import { notFound } from "next/navigation";
import { PublicStoryReader } from "@/components/stories/public-story-reader";
import { loadStoryByShareToken } from "@/lib/stories/load-by-share";

export default async function PublicShareStoryPage({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}) {
  const { shareToken } = await params;
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
