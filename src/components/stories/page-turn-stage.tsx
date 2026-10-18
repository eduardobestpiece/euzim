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
  /** Na landing, só a folha de texto (metade direita) vira. */
  leaf = "full",
}: {
  turn: PageTurnDir;
  children: ReactNode;
  className?: string;
  leaf?: "full" | "text";
}) {
  return (
    <div
      className={cn(
        "story-page-turn-stage",
        leaf === "text" && "is-text-leaf",
        className,
      )}
    >
      <div
        className={cn(
          "story-page-turn-sheet",
          leaf === "text" && "is-text-leaf",
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
