import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, Sparkles } from "lucide-react";
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
    <main className="min-h-full bg-[radial-gradient(ellipse_at_top,_oklch(0.94_0.04_85),_transparent_55%)]">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5 md:px-6">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-amber-600" />
          <span className="font-heading font-semibold">Estúdio Mágico</span>
        </div>
        <Button asChild size="sm">
          <Link href="/signup">Criar conta grátis</Link>
        </Button>
      </header>

      <div className="mx-auto max-w-3xl space-y-8 px-4 pb-16 md:px-6">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">História compartilhada</p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
            {story.title}
          </h1>
        </div>

        <div className="space-y-6">
          {story.pages.map((page) => (
            <article
              key={page.pageIndex}
              className="overflow-hidden rounded-2xl border border-border/60 bg-background"
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
                <p className="leading-relaxed">{page.text}</p>
              </div>
            </article>
          ))}
        </div>

        <section className="rounded-2xl border border-amber-700/20 bg-amber-50/50 p-6 text-center">
          <BookOpen className="mx-auto mb-3 size-8 text-amber-700" />
          <h2 className="font-heading text-xl font-semibold">
            Crie histórias com o avatar da sua criança
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            No Estúdio Mágico, pais geram aventuras personalizadas com IA e
            quiz terapêutico.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button asChild size="lg">
              <Link href="/signup">Começar agora</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/login">Já tenho conta</Link>
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
