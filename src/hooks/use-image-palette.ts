"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_PALETTE,
  extractPaletteFromImageData,
  type StoryPalette,
} from "@/lib/stories/palette";

/**
 * Extrai paleta da imagem no browser (canvas), sem IA.
 * Requer CORS liberado na URL da imagem (Storage público OK).
 */
export function useImagePalette(
  imageUrl: string | null | undefined,
): StoryPalette {
  const [palette, setPalette] = useState<StoryPalette>(DEFAULT_PALETTE);

  useEffect(() => {
    if (!imageUrl) {
      setPalette(DEFAULT_PALETTE);
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";

    img.onload = () => {
      try {
        const size = 96;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size);
        const next = extractPaletteFromImageData(data, DEFAULT_PALETTE);
        if (!cancelled) setPalette(next);
      } catch {
        if (!cancelled) setPalette(DEFAULT_PALETTE);
      }
    };
    img.onerror = () => {
      if (!cancelled) setPalette(DEFAULT_PALETTE);
    };
    img.src = imageUrl;

    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  return palette;
}
