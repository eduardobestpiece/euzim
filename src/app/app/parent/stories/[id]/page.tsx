import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
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
        </div>

        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          {story.title}
        </h1>

        <div className="space-y-8">
          {story.pages.map((page) => (
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
                <p className="text-base leading-relaxed md:text-lg">
                  {page.text}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
