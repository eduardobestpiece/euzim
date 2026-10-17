"use client";

import { useCallback, useRef, useState } from "react";

export type PageTurnDir = "idle" | "next" | "prev";

/** Duração total da virada de página (CSS deve espelhar). */
export const PAGE_TURN_MS = 720;
/** Momento em que o conteúdo troca (meio da dobra). */
export const PAGE_TURN_SWAP_MS = 340;

/**
 * Controla animação de virar página (landing + leitor da plataforma).
 * Trava cliques durante a animação e troca o índice no meio da dobra.
 */
export function usePageTurn(opts: {
  index: number;
  setIndex: (updater: (i: number) => number) => void;
  min?: number;
  max: number;
}) {
  const { index, setIndex, min = 0, max } = opts;
  const [turn, setTurn] = useState<PageTurnDir>("idle");
  const busy = useRef(false);
  const timers = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  }, []);

  const runTurn = useCallback(
    (dir: "next" | "prev") => {
      if (busy.current) return false;
      if (dir === "next" && index >= max) return false;
      if (dir === "prev" && index <= min) return false;

      busy.current = true;
      setTurn(dir);
      clearTimers();

      const swapId = window.setTimeout(() => {
        setIndex((i) => (dir === "next" ? Math.min(max, i + 1) : Math.max(min, i - 1)));
      }, PAGE_TURN_SWAP_MS);

      const doneId = window.setTimeout(() => {
        setTurn("idle");
        busy.current = false;
      }, PAGE_TURN_MS);

      timers.current = [swapId, doneId];
      return true;
    },
    [clearTimers, index, max, min, setIndex],
  );

  const goNext = useCallback(() => runTurn("next"), [runTurn]);
  const goPrev = useCallback(() => runTurn("prev"), [runTurn]);

  return { turn, goNext, goPrev, isTurning: turn !== "idle" };
}
