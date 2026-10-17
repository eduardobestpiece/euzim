"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { STORY_BUILD } from "@/lib/stories/build";

const SUGGESTIONS = [
  "medo de moradores de rua e aprender compaixão",
  "a floresta encantada da coragem",
  "o primeiro dia na escola",
  "perder o brinquedo favorito e encontrar amigos",
];

export function NewStoryForm({
  childName,
  friendName,
  remaining,
}: {
  childName?: string | null;
  friendName?: string | null;
  remaining: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const disabled = remaining <= 0;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setStatus(null);
    const theme = String(new FormData(e.currentTarget).get("theme") ?? "").trim();
    if (!theme) {
      setError("Escreva o tema ou o desejo da história.");
      return;
    }

    startTransition(async () => {
      try {
        setStatus("1/4 Contador Sábio escrevendo o rascunho…");
        // A API faz todo o pipeline (pode levar alguns minutos)
        const res = await fetch("/api/stories/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ theme }),
        });
        const body = (await res.json()) as {
          error?: string;
          storyId?: string;
          redirectTo?: string;
          pages?: number;
          title?: string;
        };
        if (!res.ok || body.error) {
          setError(body.error || `Falha (${res.status}).`);
          setStatus(null);
          return;
        }
        setStatus(
          `Pronta: “${body.title ?? "História"}” · ${body.pages ?? "?"} atos Pixar`,
        );
        // hard nav — evita abrir história antiga em cache
        window.location.assign(
          body.redirectTo || `/app/parent/stories/${body.storyId}`,
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Falha de rede ao gerar a história.",
        );
        setStatus(null);
      }
    });
  }

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="size-5 text-amber-700" />
          Nova História
        </CardTitle>
        <CardDescription>
          <span className="font-mono text-[10px] font-semibold text-emerald-800">
            {STORY_BUILD}
          </span>
          {" · "}
          Pipeline Contador Sábio: rascunho → revisão → 5–10 atos → imagens
          Disney/Pixar
          {childName ? ` com ${childName}` : ""}
          {friendName ? ` e ${friendName}` : ""} como protagonistas. Restam{" "}
          {remaining} neste mês. Pode levar 2–5 minutos.
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="theme">Tema ou desejo dos pais</Label>
            <Input
              id="theme"
              name="theme"
              required
              disabled={disabled || pending}
              placeholder="ex.: meu filho tem medo de… e quero que aprenda…"
              list="theme-suggestions"
            />
            <datalist id="theme-suggestions">
              {SUGGESTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-foreground hover:text-foreground"
                disabled={disabled || pending}
                onClick={(e) => {
                  const form = (e.target as HTMLElement).closest("form");
                  const input = form?.querySelector<HTMLInputElement>("#theme");
                  if (input) input.value = s;
                }}
              >
                {s}
              </button>
            ))}
          </div>

          <ul className="space-y-1 text-xs text-muted-foreground">
            <li className="flex items-center gap-1.5">
              <BookOpen className="size-3.5" />
              História profunda, oral, com diálogos e parábolas leves
            </li>
            <li className="flex items-center gap-1.5">
              <Sparkles className="size-3.5" />
              Ilustrações Pixar por ato, com os avatares da criança e do amigo
            </li>
          </ul>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          {status ? (
            <p className="text-sm text-amber-800" role="status">
              {status}
            </p>
          ) : null}

          <Button
            type="submit"
            size="lg"
            className="w-full gap-2"
            disabled={disabled || pending}
          >
            <Wand2 className="size-4" />
            {pending
              ? "Gerando história Pixar…"
              : disabled
                ? "Limite mensal atingido"
                : "Gerar história"}
          </Button>
        </CardContent>
      </form>
    </Card>
  );
}
