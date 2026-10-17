/**
 * Extração de paleta no cliente (sem IA) a partir dos pixels da imagem.
 */

import type { CSSProperties } from "react";

export type Rgb = { r: number; g: number; b: number };

export type StoryPalette = {
  dominant: string;
  accent: string;
  soft: string;
  deep: string;
  text: string;
  textMuted: string;
  panelBg: string;
  panelBorder: string;
  glow: string;
};

function clamp(n: number, min = 0, max = 255): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function rgbToCss(c: Rgb): string {
  return `rgb(${clamp(c.r)} ${clamp(c.g)} ${clamp(c.b)})`;
}

export function rgbToRgba(c: Rgb, a: number): string {
  return `rgba(${clamp(c.r)}, ${clamp(c.g)}, ${clamp(c.b)}, ${a})`;
}

function luminance(c: Rgb): number {
  const srgb = [c.r, c.g, c.b].map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

function saturate(c: Rgb, amount: number): Rgb {
  const gray = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
  return {
    r: gray + (c.r - gray) * amount,
    g: gray + (c.g - gray) * amount,
    b: gray + (c.b - gray) * amount,
  };
}

function contrastInk(bg: Rgb): Rgb {
  return luminance(bg) > 0.45
    ? { r: 28, g: 24, b: 20 }
    : { r: 252, g: 248, b: 242 };
}

type Bucket = { r: number; g: number; b: number; n: number; sat: number };

/**
 * Quantiza pixels em buckets e devolve as cores mais presentes (saturadas preferidas).
 */
export function extractPaletteFromImageData(
  data: ImageData,
  fallback?: StoryPalette,
): StoryPalette {
  const buckets = new Map<string, Bucket>();
  const { data: px, width, height } = data;
  const step = Math.max(1, Math.floor(Math.min(width, height) / 48));

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      const a = px[i + 3] ?? 0;
      if (a < 200) continue;
      const r = px[i] ?? 0;
      const g = px[i + 1] ?? 0;
      const b = px[i + 2] ?? 0;
      // ignora quase branco/preto puro
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (max < 28 || min > 240) continue;
      const qr = Math.round(r / 24) * 24;
      const qg = Math.round(g / 24) * 24;
      const qb = Math.round(b / 24) * 24;
      const key = `${qr},${qg},${qb}`;
      const sat = max === 0 ? 0 : (max - min) / max;
      const prev = buckets.get(key);
      if (prev) {
        prev.r += r;
        prev.g += g;
        prev.b += b;
        prev.n += 1;
        prev.sat += sat;
      } else {
        buckets.set(key, { r, g, b, n: 1, sat });
      }
    }
  }

  const ranked = Array.from(buckets.values())
    .map((b) => ({
      r: b.r / b.n,
      g: b.g / b.n,
      b: b.b / b.n,
      score: b.n * (0.55 + (b.sat / b.n) * 1.4),
    }))
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) {
    return (
      fallback ??
      buildPaletteFromColors(
        { r: 232, g: 210, b: 170 },
        { r: 120, g: 160, b: 190 },
      )
    );
  }

  const dominant = { r: ranked[0].r, g: ranked[0].g, b: ranked[0].b };
  let accent = dominant;
  for (const c of ranked.slice(1, 8)) {
    const dr = c.r - dominant.r;
    const dg = c.g - dominant.g;
    const db = c.b - dominant.b;
    if (dr * dr + dg * dg + db * db > 2800) {
      accent = { r: c.r, g: c.g, b: c.b };
      break;
    }
  }

  return buildPaletteFromColors(dominant, accent);
}

export function buildPaletteFromColors(
  dominant: Rgb,
  accent: Rgb,
): StoryPalette {
  const soft = mix(dominant, { r: 255, g: 252, b: 248 }, 0.55);
  const deep = mix(saturate(dominant, 1.15), { r: 20, g: 18, b: 30 }, 0.35);
  const panel = mix(soft, { r: 255, g: 255, b: 255 }, 0.42);
  const ink = contrastInk(panel);
  const muted = mix(ink, panel, 0.42);
  const glow = saturate(accent, 1.25);

  return {
    dominant: rgbToCss(dominant),
    accent: rgbToCss(accent),
    soft: rgbToCss(soft),
    deep: rgbToCss(deep),
    text: rgbToCss(ink),
    textMuted: rgbToCss(muted),
    panelBg: rgbToRgba(panel, 0.92),
    panelBorder: rgbToRgba(mix(accent, dominant, 0.5), 0.35),
    glow: rgbToRgba(glow, 0.45),
  };
}

export const DEFAULT_PALETTE: StoryPalette = buildPaletteFromColors(
  { r: 236, g: 214, b: 176 },
  { r: 118, g: 168, b: 196 },
);

/** Estilo CSS inline para o fundo mágico da leitura. */
export function paletteBackgroundStyle(palette: StoryPalette): CSSProperties {
  return {
    background: `
      radial-gradient(ellipse 90% 60% at 15% 0%, ${palette.glow}, transparent 55%),
      radial-gradient(ellipse 80% 50% at 95% 20%, ${palette.accent}55, transparent 50%),
      linear-gradient(165deg, ${palette.soft} 0%, ${palette.dominant} 48%, ${palette.deep} 100%)
    `,
  };
}
