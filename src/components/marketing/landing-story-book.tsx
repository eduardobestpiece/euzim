"use client";

import { useCallback, useEffect, useRef, useState, type TouchEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  SERENA_AGULHA_DEMO,
  type DemoStoryPage,
} from "@/lib/marketing/serena-agulha-demo";
import { InlineBrand } from "@/components/brand/inline-brand";
import { PageTurnStage } from "@/components/stories/page-turn-stage";
import { usePageTurn } from "@/hooks/use-page-turn";

export function LandingStoryBook({
  pages = SERENA_AGULHA_DEMO.pages as DemoStoryPage[],
  title = SERENA_AGULHA_DEMO.title,
}: {
  pages?: DemoStoryPage[];
  title?: string;
}) {
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const total = pages.length;
  const { turn, goNext, goPrev } = usePageTurn({
    index,
    setIndex,
    max: Math.max(0, total - 1),
  });
  const page = pages[index];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goPrev, goNext]);

  const onTouchStart = useCallback((e: TouchEvent) => {
    const t = e.changedTouches[0];
    touchStartX.current = t.clientX;
    touchStartY.current = t.clientY;
  }, []);

  const onTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (touchStartX.current == null || touchStartY.current == null) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStartX.current;
      const dy = t.clientY - touchStartY.current;
      touchStartX.current = null;
      touchStartY.current = null;
      if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
      if (dx < 0) goNext();
      else goPrev();
    },
    [goNext, goPrev],
  );

  if (!page) return null;

  return (
    <section
      id="historia-demo"
      aria-labelledby="historia-demo-heading"
      className="landing-story relative z-10 px-5 py-16 sm:px-8 sm:py-20 md:px-12 md:py-24"
    >
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto mb-8 max-w-2xl text-center sm:mb-10">
          <h2
            id="historia-demo-heading"
            className="font-story-display text-2xl uppercase text-[var(--euzim-ink)] sm:text-3xl md:text-[2.1rem]"
          >
            Uma história feita na <InlineBrand />
          </h2>
          <p className="font-story-body mt-3 text-base leading-relaxed text-[var(--euzim-ink-soft)] sm:text-[1.05rem]">
            Leia livremente, passe as páginas como em um livro de verdade.
          </p>
        </div>

        <div
          className="landing-book"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div className="landing-book-stage">
            <div className="landing-book-spine" aria-hidden />
            <div className="landing-book-spread">
              <figure className="landing-book-image">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={page.imageUrl}
                  alt={page.altText}
                  className="h-full w-full object-cover"
                  draggable={false}
                />
                {index === 0 ? (
                  <figcaption className="landing-book-title-overlay">
                    <span className="font-story-display text-lg uppercase leading-tight sm:text-xl md:text-2xl">
                      {title}
                    </span>
                  </figcaption>
                ) : null}
              </figure>

              <PageTurnStage turn={turn} leaf="text" className="landing-book-text-turn">
                <div className="landing-book-text">
                  <p className="landing-book-page-label font-story-body">
                    {page.title || `Página ${index + 1}`}
                  </p>
                  <div className="landing-book-scroll">
                    <p className="font-story-body whitespace-pre-wrap text-[1.02rem] font-semibold leading-[1.75] text-[var(--euzim-ink)] sm:text-[1.1rem] sm:leading-[1.8]">
                      {page.text}
                    </p>
                  </div>
                </div>
              </PageTurnStage>
            </div>
          </div>

          <div className="landing-book-controls">
            <Button
              type="button"
              variant="outline"
              className="font-story-body gap-1 rounded-xl border-[var(--euzim-violet)]/20 bg-white/90 shadow-sm"
              disabled={index === 0 || turn !== "idle"}
              onClick={goPrev}
              aria-label="Página anterior"
            >
              <ChevronLeft className="size-4" />
              Anterior
            </Button>
            <p
              className="font-story-body text-xs font-bold tracking-[0.18em] uppercase text-[var(--euzim-ink-soft)]"
              aria-live="polite"
            >
              {index + 1} / {total}
            </p>
            <Button
              type="button"
              className="landing-cta-btn font-story-body gap-1 rounded-xl border-0 shadow-md"
              disabled={index >= total - 1 || turn !== "idle"}
              onClick={goNext}
              aria-label="Próxima página"
            >
              Próxima
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <p className="mt-3 text-center font-story-body text-[0.78rem] text-[var(--euzim-ink-soft)] sm:text-[0.82rem]">
            Deslize ou use ← → no teclado para virar as páginas
          </p>
        </div>
      </div>
    </section>
  );
}
