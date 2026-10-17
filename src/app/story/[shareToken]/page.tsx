import Link from "next/link";
import { notFound } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <main className="relative min-h-full">
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/80 px-4 py-3 backdrop-blur md:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Sparkles className="size-4 shrink-0 text-amber-600" />
            <span className="truncate font-heading text-sm font-semibold sm:text-base">
              Estúdio Mágico
            </span>
          </div>
          <Button asChild size="sm" className="shrink-0">
            <Link href="/signup">
              Criar história com o avatar da sua criança
            </Link>
          </Button>
        </div>
      </header>

      <PublicStoryReader
        title={story.title}
        pages={story.pages}
        shareToken={story.shareToken || shareToken}
        storyId={story.id}
      />
    </main>
  );
}
