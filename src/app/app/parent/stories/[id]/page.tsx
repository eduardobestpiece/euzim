import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Share2 } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { WallpaperDialog } from "@/components/parent/wallpaper-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/get-user";
import { loadStoryForParent } from "@/lib/stories/load-story";

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

  const shareHref = `/story/${story.shareToken ?? story.id}`;
  const lastImage = [...story.pages]
    .reverse()
    .find((p) => Boolean(p.imageUrl));

  return (
    <AppShell user={user} title="História">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/app/parent" className="gap-1.5">
              <ArrowLeft className="size-3.5" />
              Voltar
            </Link>
          </Button>
          <Badge variant="secondary">{story.source}</Badge>
          <Button asChild variant="outline" size="sm">
            <Link href={shareHref} className="gap-1.5">
              <Share2 className="size-3.5" />
              Página pública
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

        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          {story.title}
        </h1>

        {story.questions.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            Quiz salvo: {story.questions.length} perguntas
          </p>
        ) : null}

        <div className="space-y-8">
          {story.pages.map((page, idx) => {
            const isLast = idx === story.pages.length - 1;
            return (
              <article
                key={page.pageIndex}
                className="overflow-hidden rounded-2xl border border-border/70"
              >
                {page.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={page.imageUrl}
                    alt={page.altText}
                    className="aspect-[16/10] w-full object-cover"
                  />
                ) : null}
                <div className="space-y-2 p-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Página {page.pageIndex + 1}
                  </p>
                  <p className="whitespace-pre-wrap text-base leading-relaxed md:text-lg">
                    {page.text}
                  </p>
                  {isLast && page.imageUrl ? (
                    <div className="pt-2">
                      <WallpaperDialog
                        imageUrl={page.imageUrl}
                        title={story.title}
                      />
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
