import { notFound } from "next/navigation";
import { StoryFlipbook } from "@/components/kids/story-flipbook";
import { getCurrentUser } from "@/lib/auth/get-user";
import { loadStoryForParent } from "@/lib/stories/load-story";
import { getQuizProgress } from "@/lib/stories/games-store";

export default async function KidsReadPage({
  params,
}: {
  params: Promise<{ storyId: string }>;
}) {
  const { storyId } = await params;
  const user = await getCurrentUser();
  if (!user) return null;

  const story = await loadStoryForParent(storyId, user.id);
  if (!story) notFound();

  const progress = await getQuizProgress(storyId, user.id);

  return (
    <StoryFlipbook
      storyId={story.id}
      title={story.title}
      pages={story.pages}
      questions={story.questions}
      initialQuizScore={progress?.score ?? null}
      shareToken={story.shareToken ?? story.id}
      readingMode
      backHref="/app/kids"
      backLabel="Voltar para a biblioteca"
      showShare={false}
    />
  );
}
