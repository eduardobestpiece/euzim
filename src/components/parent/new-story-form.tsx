"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Wand2 } from "lucide-react";
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
import {
  generateStoryAction,
  type GenerateStoryResult,
} from "@/lib/stories/generate-story-action";

const initial: GenerateStoryResult = {};

const SUGGESTIONS = [
  "a floresta encantada",
  "o castelo das nuvens",
  "o fundo do mar",
  "a cidade dos brinquedos",
];

export function NewStoryForm({
  childName,
  remaining,
}: {
  childName?: string | null;
  remaining: number;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    generateStoryAction,
    initial,
  );

  useEffect(() => {
    if (state.success && state.storyId) {
      router.push(`/app/parent/stories/${state.storyId}`);
    }
  }, [state.success, state.storyId, router]);

  const disabled = remaining <= 0;

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="size-5 text-amber-700" />
          Nova História
        </CardTitle>
        <CardDescription>
          Gera 4 páginas com texto mock e imagens Unsplash
          {childName ? ` para ${childName}` : ""}. Restam {remaining} neste
          mês.
        </CardDescription>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="theme">Tema da aventura</Label>
            <Input
              id="theme"
              name="theme"
              required
              disabled={disabled || pending}
              placeholder="ex.: a floresta encantada"
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

          {state.error ? (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p className="text-sm text-emerald-700">
              História criada ({state.persistedTo}) — abrindo…
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
              ? "Gerando…"
              : disabled
                ? "Limite mensal atingido"
                : "Gerar história"}
          </Button>
        </CardContent>
      </form>
    </Card>
  );
}
