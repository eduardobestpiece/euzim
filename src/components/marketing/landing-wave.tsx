import { cn } from "@/lib/utils";

export type LandingBand =
  | "paper"
  | "cream"
  | "mint"
  | "lavender"
  | "peach"
  | "offer";

/**
 * Ponte fluida entre duas faixas.
 * Fundo = seção de cima; onda SVG = seção de baixo (sem corte reto).
 */
export function LandingWave({
  from,
  to,
  className,
}: {
  from: LandingBand;
  to: LandingBand;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn("landing-wave", `from-${from}`, `to-${to}`, className)}
    >
      <svg
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        className="landing-wave-svg"
      >
        <path
          className="landing-wave-fill"
          d="M0 52C240 108 480 120 720 76C960 32 1200 12 1440 44V120H0V52Z"
        />
      </svg>
    </div>
  );
}
