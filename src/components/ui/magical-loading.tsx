"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

const DEFAULT_MESSAGES = [
  "Contador Sábio escrevendo…",
  "Tecendo diálogos mágicos…",
  "Pintando cenas Pixar…",
  "Polindo a moral com carinho…",
  "Quase pronto…",
];

export function MagicalLoading({
  messages = DEFAULT_MESSAGES,
  status,
}: {
  messages?: string[];
  /** Mensagem atual (ex.: “Pintando cena 3/7…”). Sobrescreve a rotação. */
  status?: string | null;
}) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (status) return;
    const id = window.setInterval(() => {
      setTick((t) => t + 1);
    }, 2800);
    return () => window.clearInterval(id);
  }, [status]);

  const label =
    status?.trim() ||
    messages[tick % messages.length] ||
    DEFAULT_MESSAGES[0];

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-amber-200/60 bg-[radial-gradient(ellipse_at_top,_oklch(0.97_0.04_85),_oklch(0.96_0.02_210)_55%,_oklch(0.94_0.03_40))] px-4 py-8 text-center"
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {Array.from({ length: 18 }).map((_, i) => (
          <span
            key={i}
            className="absolute block size-1 rounded-full bg-amber-500/40 animate-pulse"
            style={{
              left: `${(i * 17 + 7) % 100}%`,
              top: `${(i * 29 + 11) % 100}%`,
              animationDelay: `${(i % 6) * 0.35}s`,
            }}
          />
        ))}
      </div>
      <div className="relative mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-amber-100/80 text-amber-800 shadow-sm">
        <Sparkles className="size-6 animate-spin [animation-duration:3s]" />
      </div>
      <p className="relative font-heading text-base font-semibold text-amber-950">
        {label}
      </p>
      <p className="relative mt-1 text-xs text-amber-900/70">
        Pode levar alguns minutos — não feche esta aba.
      </p>
    </div>
  );
}
