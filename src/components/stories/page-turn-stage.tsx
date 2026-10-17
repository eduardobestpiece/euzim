"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { PageTurnDir } from "@/hooks/use-page-turn";

/**
 * Envelope 3D de virada de página (papel de livro).
 * Usado na landing e no StoryFlipbook da plataforma.
 */
export function PageTurnStage({
  turn,
  children,
  className,
}: {
  turn: PageTurnDir;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("story-page-turn-stage", className)}>
      <div
        className={cn(
          "story-page-turn-sheet",
          turn === "next" && "is-turn-next",
          turn === "prev" && "is-turn-prev",
        )}
      >
        <div className="story-page-turn-face">{children}</div>
        <div className="story-page-turn-curl" aria-hidden />
      </div>
    </div>
  );
}
