import { BookOpen, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="relative flex min-h-full flex-1 flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_oklch(0.92_0.04_85)_0%,_transparent_55%),radial-gradient(ellipse_at_bottom_right,_oklch(0.9_0.06_200)_0%,_transparent_45%)]"
      />
      <header className="relative z-10 flex items-center justify-between px-6 py-5 md:px-10">
        <div className="flex items-center gap-2 text-sm font-medium tracking-wide text-foreground/70">
          <Sparkles className="size-4 text-amber-600" aria-hidden />
          Fase 1 — infraestrutura
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-6 pb-20 pt-8 md:px-10">
        <div className="space-y-4">
          <p className="font-heading text-5xl font-semibold tracking-tight text-foreground md:text-6xl">
            Estúdio Mágico
          </p>
          <h1 className="max-w-xl text-xl leading-relaxed text-foreground/80 md:text-2xl">
            Histórias infantis personalizadas com o avatar da sua criança.
          </h1>
          <p className="max-w-lg text-base leading-relaxed text-muted-foreground">
            Setup da Fase 1 concluído: Next.js, Tailwind, Shadcn UI e clientes
            Supabase. Auth, onboarding e gerador chegam nas próximas fases.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" disabled className="gap-2">
            <BookOpen className="size-4" aria-hidden />
            Entrar (em breve)
          </Button>
          <p className="text-sm text-muted-foreground">
            Dev server na porta 8080 · schema em{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
              supabase/schema.sql
            </code>
          </p>
        </div>
      </main>
    </div>
  );
}
