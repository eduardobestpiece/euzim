import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { PinGuardButton } from "@/components/kids/pin-guard";
import { StoryFlipbook } from "@/components/kids/story-flipbook";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/get-user";
import { loadStoryForParent } from "@/lib/stories/load-story";
import { buildQuizFromPages } from "@/lib/stories/quiz";
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

  const questions = buildQuizFromPages(story.title, story.pages);
  const progress = await getQuizProgress(storyId, user.id);

  return (
    <AppShell user={user} title="Ler história" kidsMode>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/app/kids" className="gap-1.5">
            <ArrowLeft className="size-3.5" />
            Biblioteca
          </Link>
        </Button>
        <PinGuardButton label="Área dos pais" href="/app/parent" />
      </div>

      <StoryFlipbook
        storyId={story.id}
        title={story.title}
        pages={story.pages}
        questions={questions}
        initialQuizScore={progress?.score ?? null}
      />
    </AppShell>
  );
}
