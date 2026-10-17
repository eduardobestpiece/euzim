import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { StoryFlipbook } from "@/components/kids/story-flipbook";
import { WallpaperDialog } from "@/components/parent/wallpaper-dialog";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/get-user";
import { loadStoryForParent } from "@/lib/stories/load-story";
import { getQuizProgress } from "@/lib/stories/games-store";

export default async function StoryReaderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return null;

  const story = await loadStoryForParent(id, user.id);
  if (!story) notFound();

  const progress = await getQuizProgress(story.id, user.id);
  const lastImage = [...story.pages]
    .reverse()
    .find((p) => Boolean(p.imageUrl));

  return (
    <AppShell user={user} title="História" wide>
      <div className="mb-3 flex flex-wrap items-center gap-3 px-1">
        <Button asChild variant="ghost" size="sm">
          <Link href="/app/parent" className="gap-1.5">
            <ArrowLeft className="size-3.5" />
            Voltar
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/app/kids/read/${story.id}`}>Abrir no kids</Link>
        </Button>
        {lastImage?.imageUrl ? (
          <WallpaperDialog
            imageUrl={lastImage.imageUrl}
            title={story.title}
          />
        ) : null}
      </div>

      <StoryFlipbook
        storyId={story.id}
        title={story.title}
        pages={story.pages}
        questions={story.questions}
        initialQuizScore={progress?.score ?? null}
        shareToken={story.shareToken ?? story.id}
        readingMode
      />
    </AppShell>
  );
}
