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
  /** Papel opaco do livro (sem transparência). */
  paper: string;
  paperEdge: string;
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

/** Aceita `rgb(r g b)` / `rgb(r, g, b)` e devolve rgba com alpha 0–1. */
export function withAlpha(cssColor: string, alpha: number): string {
  const spaced = cssColor.match(
    /rgba?\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)/,
  );
  if (spaced) {
    return `rgba(${spaced[1]}, ${spaced[2]}, ${spaced[3]}, ${alpha})`;
  }
  const commas = cssColor.match(
    /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/,
  );
  if (commas) {
    return `rgba(${commas[1]}, ${commas[2]}, ${commas[3]}, ${alpha})`;
  }
  return cssColor;
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
  // Mantém mais cor da ilustração (evita lavar para branco puro).
  const soft = mix(dominant, { r: 255, g: 248, b: 240 }, 0.38);
  const deep = mix(saturate(dominant, 1.2), { r: 32, g: 22, b: 18 }, 0.42);
  const paperRgb = mix(dominant, { r: 255, g: 246, b: 232 }, 0.48);
  const panel = mix(paperRgb, { r: 255, g: 252, b: 246 }, 0.18);
  // Tinta escura o suficiente para contraste forte no papel claro.
  const ink =
    luminance(paperRgb) > 0.55
      ? { r: 42, g: 28, b: 20 }
      : contrastInk(paperRgb);
  const muted = mix(ink, paperRgb, 0.38);
  const glow = saturate(accent, 1.25);
  const edge = mix(deep, accent, 0.35);

  return {
    dominant: rgbToCss(dominant),
    accent: rgbToCss(accent),
    soft: rgbToCss(soft),
    deep: rgbToCss(deep),
    text: rgbToCss(ink),
    textMuted: rgbToCss(muted),
    panelBg: rgbToRgba(panel, 0.97),
    panelBorder: rgbToRgba(mix(accent, dominant, 0.5), 0.28),
    glow: rgbToRgba(glow, 0.4),
    paper: rgbToCss(paperRgb),
    paperEdge: rgbToCss(edge),
  };
}

export const DEFAULT_PALETTE: StoryPalette = buildPaletteFromColors(
  { r: 236, g: 214, b: 176 },
  { r: 118, g: 168, b: 196 },
);

/** Estilo CSS inline para o ambiente ao redor do livro. */
export function paletteBackgroundStyle(palette: StoryPalette): CSSProperties {
  return {
    background: `
      radial-gradient(ellipse 70% 45% at 12% 8%, ${palette.glow}, transparent 58%),
      radial-gradient(ellipse 60% 40% at 92% 18%, ${withAlpha(palette.accent, 0.27)}, transparent 52%),
      radial-gradient(ellipse 80% 55% at 50% 100%, ${withAlpha(palette.deep, 0.33)}, transparent 60%),
      linear-gradient(168deg, ${palette.soft} 0%, ${palette.dominant} 42%, ${palette.deep} 100%)
    `,
  };
}

/** Papel opaco da página — contraste estável sob o texto. */
export function palettePaperStyle(palette: StoryPalette): CSSProperties {
  return {
    backgroundColor: palette.paper,
    color: palette.text,
    boxShadow: `
      inset 0 1px 0 rgba(255,255,255,0.55),
      inset 0 -18px 40px ${withAlpha(palette.deep, 0.08)}
    `,
  };
}
