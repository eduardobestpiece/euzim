import sharp from "sharp";

/** Difference hash 64-bit (string de '0'/'1') para comparar imagens. */
export async function differenceHash(jpeg: Buffer): Promise<string> {
  const raw = await sharp(jpeg, { failOn: "none" })
    .greyscale()
    .resize(9, 8, { fit: "fill" })
    .raw()
    .toBuffer();

  let hash = "";
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const left = raw[y * 9 + x] ?? 0;
      const right = raw[y * 9 + x + 1] ?? 0;
      hash += left < right ? "1" : "0";
    }
  }
  return hash;
}

export function hammingDistance(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let d = 0;
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) d += 1;
  }
  d += Math.abs(a.length - b.length);
  return d;
}

/** Distância baixa = imagens visualmente muito parecidas. */
/** Mais estrito: 10 ainda deixava passar frames quase iguais entre páginas. */
export const DUPLICATE_HAMMING_THRESHOLD = 7;

export function isNearDuplicate(
  candidate: string,
  previous: string[],
  threshold = DUPLICATE_HAMMING_THRESHOLD,
): boolean {
  return previous.some((h) => hammingDistance(candidate, h) < threshold);
}

/** Ângulos/composições obrigatórias por índice de página — anti-repetição estrutural. */
export const UNIQUE_SHOTS = [
  "wide establishing shot showing the full location, characters small in frame",
  "medium two-shot at eye level with clear foreground and background depth",
  "over-the-shoulder shot looking toward another character or the scene focus",
  "close-up on the child's face conveying the beat's emotion, friend partially visible",
  "low-angle cinematic shot looking slightly up at the characters",
  "gentle high-angle / soft bird's-eye of the whole interaction",
  "side-profile walking or moving through the environment",
  "characters seated in conversation with asymmetric framing",
  "environmental storytelling: location dominates, characters mid-ground",
  "warm backlight silhouette moment with readable poses",
  "dutch-tilt-free but dynamic diagonal composition with strong foreground prop",
  "three-quarter tracking feel: characters mid-stride, motion implied",
] as const;

export function shotForPage(pageIndex: number): string {
  return UNIQUE_SHOTS[pageIndex % UNIQUE_SHOTS.length];
}
