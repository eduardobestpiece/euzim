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
      <header className="sticky top-0 z-20 border-b border-border/50 bg-background/85 px-4 py-3 backdrop-blur md:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Sparkles className="size-4 shrink-0 text-amber-600" />
            <span className="truncate font-heading text-sm font-semibold sm:text-base">
              Estúdio Mágico
            </span>
          </div>
          <Button asChild size="sm" className="shrink-0">
            <Link href="/signup">Criar conta</Link>
          </Button>
        </div>
      </header>

      <PublicStoryReader
        title={story.title}
        sourceLabel={`História compartilhada${story.source === "supabase" ? "" : " · demo"}`}
        pages={story.pages}
      />

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/95 p-3 backdrop-blur supports-[padding:max(0px)]:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-center text-sm font-medium sm:text-left">
            Crie aventuras mágicas com o avatar da sua criança.
          </p>
          <div className="flex gap-2">
            <Button asChild className="flex-1 sm:flex-none" size="lg">
              <Link href="/signup">Começar grátis</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="flex-1 sm:flex-none"
              size="lg"
            >
              <Link href="/login">Entrar</Link>
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
