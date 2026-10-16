"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { saveQuizTherapyAction } from "@/lib/stories/quiz-actions";
import type { QuizQuestion } from "@/lib/stories/quiz";

export function QuizTherapy({
  storyId,
  title,
  questions,
  initialScore,
}: {
  storyId: string;
  title: string;
  questions: QuizQuestion[];
  initialScore?: number | null;
}) {
  const [answers, setAnswers] = useState<(number | null)[]>(
    () => questions.map(() => null),
  );
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(
    typeof initialScore === "number" ? true : false,
  );
  const [score, setScore] = useState(initialScore ?? 0);
  const [persistedTo, setPersistedTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const current = questions[step];
  const allAnswered = answers.every((a) => a !== null);

  function choose(optionIndex: number) {
    setAnswers((prev) => {
      const next = [...prev];
      next[step] = optionIndex;
      return next;
    });
  }

  function finish() {
    if (!allAnswered) {
      setError("Responda todas as perguntas.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await saveQuizTherapyAction({
        storyId,
        title,
        questions,
        answers: answers as number[],
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setScore(result.score ?? 0);
      setPersistedTo(result.persistedTo ?? null);
      setDone(true);
    });
  }

  if (done) {
    return (
      <Card className="border-emerald-600/30 shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-emerald-800">
            <CheckCircle2 className="size-5" />
            Quiz concluído!
          </CardTitle>
          <CardDescription>
            Você acertou {score} de {questions.length} perguntas
            {persistedTo ? ` · salvo (${persistedTo})` : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Heart className="size-4 text-rose-500" />
            Que orgulho — ler e refletir também é magia.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="size-5 text-rose-500" />
          Quiz Therapy
        </CardTitle>
        <CardDescription>
          Três perguntinhas sobre a história — no seu tempo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Pergunta {step + 1} de {questions.length}
        </p>
        <p className="font-heading text-lg font-semibold">{current.prompt}</p>
        <ul className="space-y-2">
          {current.options.map((option, index) => {
            const selected = answers[step] === index;
            return (
              <li key={option}>
                <button
                  type="button"
                  onClick={() => choose(index)}
                  className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition ${
                    selected
                      ? "border-foreground bg-muted"
                      : "border-border/70 hover:border-foreground/40"
                  }`}
                >
                  {option}
                </button>
              </li>
            );
          })}
        </ul>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            Anterior
          </Button>
          {step < questions.length - 1 ? (
            <Button
              type="button"
              className="flex-1"
              disabled={answers[step] === null}
              onClick={() => setStep((s) => s + 1)}
            >
              Próxima
            </Button>
          ) : (
            <Button
              type="button"
              className="flex-1"
              disabled={!allAnswered || pending}
              onClick={finish}
            >
              {pending ? "Salvando…" : "Finalizar quiz"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
