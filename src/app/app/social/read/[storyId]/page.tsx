import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { AppPageFallback } from "@/components/app/app-page-fallback";
import { StoryFlipbook } from "@/components/kids/story-flipbook";
import { getCurrentUser } from "@/lib/auth/get-user";
import { getQuizProgress } from "@/lib/stories/games-store";
import { loadStoryForViewer } from "@/lib/social/load-story-for-viewer";

async function SocialReadInner({
  id,
  kidsMode,
}: {
  id: string;
  kidsMode: boolean;
}) {
  await connection();
  const user = await getCurrentUser();
  if (!user) return null;

  const story = await loadStoryForViewer(id, user.id);
  if (!story) notFound();

  const progress = await getQuizProgress(story.id, user.id);

  return (
    <StoryFlipbook
      storyId={story.id}
      title={story.title}
      pages={story.pages}
      questions={story.questions}
      initialQuizScore={progress?.score ?? null}
      shareToken={story.shareToken ?? story.id}
      readingMode
      backHref={kidsMode ? "/app/social?mode=kids" : "/app/social"}
      backLabel="Voltar ao Social"
      showShare={false}
    />
  );
}

export default function SocialReadPage({
  params,
  searchParams,
}: {
  params: Promise<{ storyId: string }>;
  searchParams?: Promise<{ mode?: string }>;
}) {
  return (
    <Suspense fallback={<AppPageFallback label="Carregando história…" />}>
      <SocialReadBridge params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function SocialReadBridge({
  params,
  searchParams,
}: {
  params: Promise<{ storyId: string }>;
  searchParams?: Promise<{ mode?: string }>;
}) {
  const { storyId } = await params;
  const sp = searchParams ? await searchParams : {};
  return (
    <SocialReadInner id={storyId} kidsMode={sp.mode === "kids"} />
  );
}
