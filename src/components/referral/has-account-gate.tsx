"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Gate “Já possui cadastro?” em links de indicação (não logado).
 */
export function HasAccountGate({
  nextPath,
  title = "Bem-vindo ao Euzim",
  subtitle = "Você chegou por um convite. Já possui cadastro na plataforma?",
}: {
  nextPath: string;
  title?: string;
  subtitle?: string;
}) {
  const safeNext =
    nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/";
  const q = `?next=${encodeURIComponent(safeNext)}`;

  return (
    <div className="mx-auto w-full max-w-md space-y-6 rounded-2xl border border-border/60 bg-background/90 p-6 shadow-none backdrop-blur">
      <div className="space-y-2 text-center">
        <h2 className="font-heading text-2xl font-semibold tracking-tight">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex flex-col gap-3">
        <Button asChild size="lg">
          <Link href={`/login${q}`}>Sim, já tenho conta</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href={`/signup${q}`}>Não, quero me cadastrar</Link>
        </Button>
      </div>
    </div>
  );
}
