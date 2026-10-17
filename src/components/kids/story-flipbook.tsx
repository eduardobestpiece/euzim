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
  palettePaperStyle,
  withAlpha,
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
      className="relative min-h-[calc(100vh-4.5rem)] w-full overflow-hidden transition-[background] duration-700"
      style={paletteBackgroundStyle(palette)}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage: `
            radial-gradient(circle at 18% 12%, ${palette.glow}, transparent 42%),
            radial-gradient(circle at 88% 78%, ${withAlpha(palette.accent, 0.2)}, transparent 38%)
          `,
        }}
        aria-hidden
      />
      {/* textura suave de papel no ambiente */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-multiply"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E")`,
        }}
        aria-hidden
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function NavOrb({
  label,
  disabled,
  onClick,
  side,
  palette,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  side: "left" | "right";
  palette: StoryPalette;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`fixed top-1/2 z-40 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full shadow-lg transition duration-300 hover:scale-105 disabled:pointer-events-none disabled:opacity-25 md:flex ${
        side === "left" ? "left-3 lg:left-5" : "right-3 lg:right-5"
      }`}
      style={{
        background: palette.paper,
        color: palette.deep,
        border: `2px solid ${withAlpha(palette.paperEdge, 0.33)}`,
        boxShadow: `0 10px 28px ${withAlpha(palette.deep, 0.2)}`,
      }}
    >
      {side === "left" ? (
        <ChevronLeft className="size-6" />
      ) : (
        <ChevronRight className="size-6" />
      )}
    </button>
  );
}

export function StoryFlipbook({
  storyId,
  title,
  pages,
  questions,
  initialQuizScore,
  shareToken,
  readingMode: _readingMode = true,
  showTitle = true,
}: {
  storyId: string;
  title: string;
  pages: Page[];
  questions: QuizQuestion[];
  initialQuizScore?: number | null;
  shareToken?: string | null;
  /** Mantido por compatibilidade — layout sempre usa página de livro. */
  readingMode?: boolean;
  showTitle?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [shareState, setShareState] = useState<"idle" | "copied" | "shared">(
    "idle",
  );
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

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
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
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

  const atLastStoryPage = index >= pages.length - 1;
  const nextDisabled = isQuiz || (!hasQuiz && atLastStoryPage);

  return (
    <ReadingShell palette={palette}>
      <div
        className="relative mx-auto flex w-full max-w-3xl flex-col px-3 py-4 md:px-5 md:py-6"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <NavOrb
          label="Página anterior"
          disabled={index === 0}
          onClick={goPrev}
          side="left"
          palette={palette}
        />
        <NavOrb
          label="Próxima página"
          disabled={nextDisabled}
          onClick={goNext}
          side="right"
          palette={palette}
        />

        {showTitle ? (
          <header className="mb-4 space-y-1.5 px-2 text-center md:mb-5">
            <p
              className="font-story-body text-[0.7rem] font-extrabold uppercase tracking-[0.22em]"
              style={{ color: palette.deep, opacity: 0.75 }}
            >
              Estúdio Mágico
            </p>
            <h1
              className="font-story-display text-[1.65rem] font-semibold leading-tight tracking-tight md:text-3xl"
              style={{ color: palette.deep }}
            >
              {title}
            </h1>
            <p
              className="font-story-body text-sm font-bold tracking-wide"
              style={{ color: palette.deep, opacity: 0.72 }}
            >
              {isQuiz
                ? "Hora do quiz!"
                : `Página ${index + 1} de ${pages.length}`}
            </p>
          </header>
        ) : null}

        {!isQuiz && page ? (
          <article
            key={`page-${index}-${page.imageUrl}`}
            className="storybook-page-enter overflow-hidden rounded-[1.35rem] shadow-2xl md:rounded-[1.6rem]"
            style={{
              background: palette.paper,
              boxShadow: `
                0 4px 0 ${withAlpha(palette.paperEdge, 0.2)},
                0 22px 48px ${withAlpha(palette.deep, 0.25)},
                0 2px 0 rgba(255,255,255,0.35) inset
              `,
            }}
          >
            {/* Ilustração — sem sticky, sem overlap com o texto */}
            <figure className="relative m-0 overflow-hidden">
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
                  style={{ background: palette.soft }}
                />
              )}
              {/* Vinheta só dentro da imagem — não invade o papel */}
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-16"
                style={{
                  background: `linear-gradient(to top, ${withAlpha(palette.deep, 0.2)}, transparent)`,
                }}
                aria-hidden
              />
            </figure>

            {/* Faixa de transição ilustração → papel */}
            <div
              className="h-2 w-full"
              style={{
                background: `linear-gradient(90deg, ${withAlpha(palette.accent, 0.33)}, ${palette.soft}, ${withAlpha(palette.accent, 0.33)})`,
              }}
              aria-hidden
            />

            {/* Papel opaco — tipografia com contraste forte */}
            <div
              className="storybook-text-enter relative px-5 pb-7 pt-5 md:px-9 md:pb-9 md:pt-6"
              style={palettePaperStyle(palette)}
            >
              <div
                className="mb-4 flex items-center justify-center gap-2"
                aria-hidden
              >
                <span
                  className="h-px w-8"
                  style={{ background: withAlpha(palette.paperEdge, 0.33) }}
                />
                <span
                  className="size-1.5 rounded-full"
                  style={{ background: palette.accent }}
                />
                <span
                  className="h-px w-8"
                  style={{ background: withAlpha(palette.paperEdge, 0.33) }}
                />
              </div>

              <p
                className="font-story-body whitespace-pre-wrap text-[1.125rem] font-medium leading-[1.75] md:text-[1.3rem] md:leading-[1.8]"
                style={{ color: palette.text }}
              >
                {page.text}
              </p>

              <div className="mt-8 flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="font-story-body gap-1 border-0 shadow-sm"
                  style={{
                    background: `${palette.soft}`,
                    color: palette.text,
                  }}
                  disabled={index === 0}
                  onClick={goPrev}
                >
                  <ChevronLeft className="size-4" />
                  Voltar
                </Button>
                <p
                  className="font-story-body hidden text-xs font-bold tracking-[0.18em] uppercase sm:block"
                  style={{ color: palette.textMuted }}
                >
                  {index + 1} / {pages.length}
                </p>
                <Button
                  type="button"
                  className="font-story-body gap-1 border-0 shadow-md"
                  style={{ background: palette.deep, color: palette.paper }}
                  onClick={goNext}
                  disabled={nextDisabled && !hasQuiz}
                >
                  {atLastStoryPage && hasQuiz ? "Quiz" : "Próxima"}
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </article>
        ) : (
          <div
            key="quiz"
            className="storybook-page-enter relative z-10 rounded-[1.35rem] p-3 md:rounded-[1.6rem] md:p-4"
            style={{
              background: palette.paper,
              boxShadow: `0 22px 48px ${withAlpha(palette.deep, 0.25)}`,
            }}
          >
            <div
              className="rounded-3xl p-1"
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
            <div className="mt-4 flex justify-center">
              <Button
                type="button"
                variant="outline"
                className="font-story-body border-0"
                style={{ background: palette.soft, color: palette.text }}
                onClick={() => setIndex(pages.length - 1)}
              >
                Rever história
              </Button>
            </div>
          </div>
        )}

        {shareToken ? (
          <button
            type="button"
            aria-label="Compartilhar história"
            onClick={() => void onShare()}
            className="fixed bottom-5 right-5 z-50 flex size-12 items-center justify-center rounded-full shadow-lg transition hover:scale-105 active:scale-95"
            style={{
              background: palette.paper,
              color: palette.deep,
              border: `2px solid ${withAlpha(palette.paperEdge, 0.27)}`,
            }}
          >
            {shareState === "idle" ? (
              <Share2 className="size-5" />
            ) : (
              <Check className="size-5" style={{ color: palette.accent }} />
            )}
          </button>
        ) : null}

        {shareState !== "idle" ? (
          <p
            role="status"
            className="font-story-body fixed bottom-20 right-5 z-50 rounded-full px-3 py-1 text-xs font-semibold shadow"
            style={{ background: palette.paper, color: palette.text }}
          >
            {shareState === "copied" ? "Link copiado" : "Compartilhado"}
          </p>
        ) : null}
      </div>
    </ReadingShell>
  );
}
