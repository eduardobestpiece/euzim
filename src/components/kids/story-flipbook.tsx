"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type TouchEvent,
} from "react";
import { Check, ChevronLeft, ChevronRight, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuizTherapy } from "@/components/kids/quiz-therapy";
import { useImagePalette } from "@/hooks/use-image-palette";
import {
  paletteBackgroundStyle,
  type StoryPalette,
} from "@/lib/stories/palette";
import type { QuizQuestion } from "@/lib/stories/quiz";
import { shareStoryLink } from "@/lib/stories/share";

type Page = {
  pageIndex: number;
  text: string;
  imageUrl: string;
  altText: string;
};

function ReadingShell({
  palette,
  children,
}: {
  palette: StoryPalette;
  children: ReactNode;
}) {
  return (
    <div
      className="relative min-h-[70vh] w-full transition-[background] duration-700 md:min-h-[75vh]"
      style={paletteBackgroundStyle(palette)}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-45"
        style={{
          backgroundImage: `radial-gradient(circle at 20% 10%, ${palette.glow}, transparent 42%), radial-gradient(circle at 85% 70%, ${palette.accent}40, transparent 40%)`,
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
  shareToken,
  readingMode = true,
  showTitle = true,
}: {
  storyId: string;
  title: string;
  pages: Page[];
  questions: QuizQuestion[];
  initialQuizScore?: number | null;
  shareToken?: string | null;
  readingMode?: boolean;
  showTitle?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [shareState, setShareState] = useState<"idle" | "copied" | "shared">(
    "idle",
  );
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  // index === pages.length means quiz (if questions exist)
  const quizIndex = pages.length;
  const hasQuiz = questions.length > 0;
  const isQuiz = hasQuiz && index >= quizIndex;
  const page = !isQuiz ? pages[index] : null;
  const palette = useImagePalette(page?.imageUrl || pages[0]?.imageUrl);

  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setIndex((i) => Math.min(hasQuiz ? quizIndex : pages.length - 1, i + 1));
  }, [hasQuiz, quizIndex, pages.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goPrev, goNext]);

  function onTouchStart(e: TouchEvent) {
    const t = e.changedTouches[0];
    touchStartX.current = t.clientX;
    touchStartY.current = t.clientY;
  }

  function onTouchEnd(e: TouchEvent) {
    if (touchStartX.current == null || touchStartY.current == null) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX.current;
    const dy = t.clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    // Horizontal swipe dominates
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
    // right→left (dx < 0) = próxima; left→right (dx > 0) = anterior
    if (dx < 0) goNext();
    else goPrev();
  }

  async function onShare() {
    if (!shareToken) return;
    const result = await shareStoryLink({ title, shareToken });
    if (result === "copied" || result === "shared") {
      setShareState(result === "copied" ? "copied" : "shared");
      window.setTimeout(() => setShareState("idle"), 2200);
    }
  }

  if (!readingMode) {
    // fallback mínimo — mesma UX de leitura
  }

  return (
    <ReadingShell palette={palette}>
      <div
        className="relative mx-auto flex w-full max-w-3xl flex-col"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Desktop fixed arrows */}
        <button
          type="button"
          aria-label="Página anterior"
          disabled={index === 0}
          onClick={goPrev}
          className="fixed left-3 top-1/2 z-40 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/25 text-white shadow-lg backdrop-blur transition hover:bg-black/40 disabled:opacity-30 md:flex lg:left-6"
        >
          <ChevronLeft className="size-6" />
        </button>
        <button
          type="button"
          aria-label="Próxima página"
          disabled={isQuiz || (!hasQuiz && index >= pages.length - 1)}
          onClick={goNext}
          className="fixed right-3 top-1/2 z-40 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/25 text-white shadow-lg backdrop-blur transition hover:bg-black/40 disabled:opacity-30 md:flex lg:right-6"
        >
          <ChevronRight className="size-6" />
        </button>

        {showTitle ? (
          <div className="space-y-1 px-4 pb-3 pt-4 text-center md:px-6">
            <h1
              className="font-heading text-2xl font-semibold tracking-tight md:text-3xl"
              style={{ color: palette.text }}
            >
              {title}
            </h1>
            <p className="text-sm" style={{ color: palette.textMuted }}>
              {isQuiz
                ? "Hora do quiz!"
                : `Ato ${index + 1} de ${pages.length}`}
            </p>
          </div>
        ) : null}

        {!isQuiz && page ? (
          <>
            {/* Sticky image blending into page */}
            <div className="sticky top-0 z-0 -mx-0 overflow-hidden">
              {page.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={page.imageUrl}
                  src={page.imageUrl}
                  alt={page.altText}
                  crossOrigin="anonymous"
                  className="aspect-[4/3] w-full object-cover md:aspect-[16/10]"
                />
              ) : (
                <div
                  className="aspect-[4/3] w-full md:aspect-[16/10]"
                  style={{ background: palette.panelBg }}
                />
              )}
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-28"
                style={{
                  background: `linear-gradient(to bottom, transparent, ${palette.soft})`,
                }}
                aria-hidden
              />
            </div>

            {/* Scrollable text */}
            <div
              className="relative z-10 -mt-10 min-h-[40vh] px-5 pb-28 pt-2 md:px-8"
              style={{ color: palette.text }}
            >
              <p className="whitespace-pre-wrap text-base leading-relaxed md:text-lg md:leading-8">
                {page.text}
              </p>

              <div className="mt-8 flex items-center justify-between gap-3 md:hidden">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-1 border-0 bg-white/70 backdrop-blur"
                  disabled={index === 0}
                  onClick={goPrev}
                >
                  <ChevronLeft className="size-4" />
                  Voltar
                </Button>
                <Button
                  type="button"
                  className="gap-1"
                  style={{ background: palette.deep, color: "#fffaf3" }}
                  onClick={goNext}
                >
                  {index === pages.length - 1 && hasQuiz ? "Quiz" : "Próxima"}
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="relative z-10 px-4 pb-28 pt-4 md:px-6">
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
            <div className="mt-4 flex justify-center md:hidden">
              <Button
                type="button"
                variant="outline"
                className="border-0 bg-white/70"
                onClick={() => setIndex(pages.length - 1)}
              >
                Rever história
              </Button>
            </div>
          </div>
        )}

        {/* Share — fixed bottom-right, non-blocking */}
        {shareToken ? (
          <button
            type="button"
            aria-label="Compartilhar história"
            onClick={() => void onShare()}
            className="fixed bottom-5 right-5 z-50 flex size-12 items-center justify-center rounded-full border border-border/60 bg-background/90 text-foreground shadow-lg backdrop-blur transition hover:scale-105 active:scale-95"
          >
            {shareState === "idle" ? (
              <Share2 className="size-5" />
            ) : (
              <Check className="size-5 text-emerald-600" />
            )}
          </button>
        ) : null}

        {shareState !== "idle" ? (
          <p
            role="status"
            className="fixed bottom-20 right-5 z-50 rounded-full bg-background/95 px-3 py-1 text-xs shadow"
          >
            {shareState === "copied" ? "Link copiado" : "Compartilhado"}
          </p>
        ) : null}

      </div>
    </ReadingShell>
  );
}
