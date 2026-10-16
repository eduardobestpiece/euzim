import Link from "next/link";
import { notFound } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <main className="relative min-h-full bg-[radial-gradient(ellipse_at_top,_oklch(0.94_0.04_85),_transparent_50%),radial-gradient(ellipse_at_bottom,_oklch(0.93_0.03_200),_transparent_45%)] pb-28">
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

      <div className="mx-auto max-w-3xl space-y-6 px-4 pt-6 md:px-6 md:pt-10">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground sm:text-sm">
            História compartilhada
            {story.source === "supabase" ? "" : " · demo"}
          </p>
          <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">
            {story.title}
          </h1>
        </div>

        <div className="space-y-5">
          {story.pages.map((page) => (
            <article
              key={page.pageIndex}
              className="overflow-hidden rounded-2xl border border-border/60 bg-background/95"
            >
              {page.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={page.imageUrl}
                  alt={page.altText}
                  className="aspect-[16/10] w-full object-cover"
                  loading={page.pageIndex === 0 ? "eager" : "lazy"}
                />
              ) : null}
              <div className="space-y-2 p-4 sm:p-5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Página {page.pageIndex + 1}
                </p>
                <p className="text-sm leading-relaxed sm:text-base sm:leading-7">
                  {page.text}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* CTA fixo mobile-first */}
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
