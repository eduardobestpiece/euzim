"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuizTherapy } from "@/components/kids/quiz-therapy";
import type { QuizQuestion } from "@/lib/stories/quiz";

type Page = {
  pageIndex: number;
  text: string;
  imageUrl: string;
  altText: string;
};

export function StoryFlipbook({
  storyId,
  title,
  pages,
  questions,
  initialQuizScore,
}: {
  storyId: string;
  title: string;
  pages: Page[];
  questions: QuizQuestion[];
  initialQuizScore?: number | null;
}) {
  const [index, setIndex] = useState(0);
  const isLast = index >= pages.length;
  const page = !isLast ? pages[index] : null;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isLast
            ? "Hora do quiz!"
            : `Página ${index + 1} de ${pages.length}`}
        </p>
      </div>

      {!isLast && page ? (
        <article className="overflow-hidden rounded-3xl border border-border/60 bg-background shadow-[0_20px_50px_-30px_rgba(0,0,0,0.35)] transition duration-300">
          {page.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={page.imageUrl}
              src={page.imageUrl}
              alt={page.altText}
              className="aspect-[16/10] w-full object-cover animate-in fade-in duration-500"
            />
          ) : null}
          <div className="space-y-3 p-6 md:p-8">
            <p className="text-base leading-relaxed md:text-lg md:leading-8">
              {page.text}
            </p>
          </div>
        </article>
      ) : (
        <QuizTherapy
          storyId={storyId}
          title={title}
          questions={questions}
          initialScore={initialQuizScore}
        />
      )}

      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          className="gap-1"
          disabled={index === 0}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
        >
          <ChevronLeft className="size-4" />
          Voltar
        </Button>

        <div className="flex gap-1.5">
          {pages.map((p) => (
            <button
              key={p.pageIndex}
              type="button"
              aria-label={`Ir para página ${p.pageIndex + 1}`}
              className={`size-2.5 rounded-full transition ${
                index === p.pageIndex ? "bg-foreground" : "bg-muted-foreground/30"
              }`}
              onClick={() => setIndex(p.pageIndex)}
            />
          ))}
          <button
            type="button"
            aria-label="Ir para o quiz"
            className={`size-2.5 rounded-full transition ${
              isLast ? "bg-rose-500" : "bg-muted-foreground/30"
            }`}
            onClick={() => setIndex(pages.length)}
          />
        </div>

        {!isLast ? (
          <Button
            type="button"
            className="gap-1"
            onClick={() => setIndex((i) => Math.min(pages.length, i + 1))}
          >
            {index === pages.length - 1 ? "Quiz" : "Próxima"}
            <ChevronRight className="size-4" />
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={() => setIndex(pages.length - 1)}
          >
            Rever história
          </Button>
        )}
      </div>
    </div>
  );
}
