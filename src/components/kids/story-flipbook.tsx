"use client";

import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuizTherapy } from "@/components/kids/quiz-therapy";
import { useImagePalette } from "@/hooks/use-image-palette";
import {
  paletteBackgroundStyle,
  type StoryPalette,
} from "@/lib/stories/palette";
import type { QuizQuestion } from "@/lib/stories/quiz";

type Page = {
  pageIndex: number;
  text: string;
  imageUrl: string;
  altText: string;
};

function ReadingStage({
  palette,
  children,
}: {
  palette: StoryPalette;
  children: ReactNode;
}) {
  return (
    <div
      className="relative -mx-4 overflow-hidden rounded-3xl px-4 py-6 transition-[background] duration-700 md:-mx-2 md:px-6 md:py-8"
      style={paletteBackgroundStyle(palette)}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage: `radial-gradient(circle at 20% 80%, ${palette.glow}, transparent 40%), radial-gradient(circle at 80% 30%, ${palette.accent}33, transparent 35%)`,
        }}
        aria-hidden
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

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
  const palette = useImagePalette(page?.imageUrl || pages[0]?.imageUrl);

  return (
    <ReadingStage palette={palette}>
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div className="space-y-1 text-center">
          <h1
            className="font-heading text-2xl font-semibold tracking-tight md:text-3xl"
            style={{ color: palette.text }}
          >
            {title}
          </h1>
          <p className="text-sm" style={{ color: palette.textMuted }}>
            {isLast
              ? "Hora do quiz!"
              : `Página ${index + 1} de ${pages.length}`}
          </p>
        </div>

        {!isLast && page ? (
          <article
            className="overflow-hidden rounded-3xl shadow-[0_24px_60px_-28px_rgba(0,0,0,0.45)] transition duration-300"
            style={{
              background: palette.panelBg,
              border: `1px solid ${palette.panelBorder}`,
              color: palette.text,
            }}
          >
            {page.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={page.imageUrl}
                src={page.imageUrl}
                alt={page.altText}
                crossOrigin="anonymous"
                className="aspect-[16/10] w-full object-cover animate-in fade-in duration-500"
              />
            ) : null}
            <div className="space-y-3 p-6 md:p-8">
              <p
                className="whitespace-pre-wrap text-base leading-relaxed md:text-lg md:leading-8"
                style={{ color: palette.text }}
              >
                {page.text}
              </p>
            </div>
          </article>
        ) : (
          <div
            className="rounded-3xl p-2"
            style={{
              background: palette.panelBg,
              border: `1px solid ${palette.panelBorder}`,
            }}
          >
            <QuizTherapy
              storyId={storyId}
              title={title}
              questions={questions}
              initialScore={initialQuizScore}
            />
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            className="gap-1 border-0 bg-white/70 backdrop-blur hover:bg-white/90"
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
                  index === p.pageIndex ? "bg-foreground" : "bg-black/25"
                }`}
                style={
                  index === p.pageIndex
                    ? { background: palette.text }
                    : undefined
                }
                onClick={() => setIndex(p.pageIndex)}
              />
            ))}
            <button
              type="button"
              aria-label="Ir para o quiz"
              className={`size-2.5 rounded-full transition ${
                isLast ? "bg-rose-500" : "bg-black/25"
              }`}
              onClick={() => setIndex(pages.length)}
            />
          </div>

          {!isLast ? (
            <Button
              type="button"
              className="gap-1"
              style={{
                background: palette.deep,
                color: "#fffaf3",
              }}
              onClick={() => setIndex((i) => Math.min(pages.length, i + 1))}
            >
              {index === pages.length - 1 ? "Quiz" : "Próxima"}
              <ChevronRight className="size-4" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="border-0 bg-white/70 backdrop-blur"
              onClick={() => setIndex(pages.length - 1)}
            >
              Rever história
            </Button>
          )}
        </div>
      </div>
    </ReadingStage>
  );
}
