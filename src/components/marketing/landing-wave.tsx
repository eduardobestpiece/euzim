import { cn } from "@/lib/utils";

/** Separador ondulado entre seções da landing. */
export function LandingWave({
  variant = "cream",
  flip = false,
  className,
}: {
  variant?: "cream" | "mint" | "lavender" | "white" | "peach";
  flip?: boolean;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "landing-wave",
        `is-${variant}`,
        flip && "is-flip",
        className,
      )}
    >
      <svg
        viewBox="0 0 1440 72"
        preserveAspectRatio="none"
        className="landing-wave-svg"
      >
        <path
          d="M0 36C180 64 360 72 720 44C1080 16 1260 8 1440 32V72H0Z"
          fill="currentColor"
        />
      </svg>
    </div>
  );
}
