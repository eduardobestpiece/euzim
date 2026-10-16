/** Reduz foto de celular para JPEG leve + preview sempre exibível. */

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;
const TARGET_BYTES = 900_000;

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|heic|heif|bmp|avif)$/i;

export type CompressedPhoto = {
  /** Arquivo para upload (preferência: JPEG). */
  file: File;
  /** Data URL JPEG (ou placeholder) — sempre renderizável no <img>. */
  previewUrl: string;
};

function looksLikeImage(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  return IMAGE_EXT.test(file.name) || file.type === "";
}

export async function compressImageForUpload(
  file: File,
): Promise<CompressedPhoto> {
  if (!looksLikeImage(file)) {
    throw new Error("Envie uma imagem (JPG, PNG ou da galeria do celular).");
  }

  try {
    const bitmap = await decodeToBitmap(file);
    try {
      const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return { file, previewUrl: attachedPlaceholderDataUrl() };
      }
      ctx.drawImage(bitmap, 0, 0, width, height);

      // Preview garantido a partir do que o canvas desenhou
      let quality = JPEG_QUALITY;
      let previewUrl = canvas.toDataURL("image/jpeg", quality);
      let blob = await canvasToBlob(canvas, "image/jpeg", quality);
      while (blob && blob.size > 1_400_000 && quality > 0.55) {
        quality -= 0.08;
        previewUrl = canvas.toDataURL("image/jpeg", quality);
        blob = await canvasToBlob(canvas, "image/jpeg", quality);
      }

      if (!blob || !previewUrl.startsWith("data:image/jpeg")) {
        return { file, previewUrl: attachedPlaceholderDataUrl() };
      }

      // Já era JPEG pequeno e canvas não reduziu muito — ok
      if (
        file.type === "image/jpeg" &&
        file.size <= TARGET_BYTES &&
        blob.size >= file.size * 0.9
      ) {
        // Ainda usa preview do canvas (exibível) + arquivo original
        return { file, previewUrl };
      }

      const base = file.name.replace(/\.[^.]+$/, "") || "foto";
      return {
        file: new File([blob], `${base}.jpg`, {
          type: "image/jpeg",
          lastModified: Date.now(),
        }),
        previewUrl,
      };
    } finally {
      bitmap.close();
    }
  } catch {
    // HEIC / formato que o browser não decodifica — sobe original; preview placeholder
    if (file.size > 12 * 1024 * 1024) {
      throw new Error("A foto ultrapassa 12 MB.");
    }
    return { file, previewUrl: attachedPlaceholderDataUrl() };
  }
}

async function decodeToBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file);
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = await loadHtmlImage(url);
      return await createImageBitmap(img);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error("Não foi possível ler esta imagem no navegador."));
    img.src = src;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), type, quality);
  });
}

/** Fallback visual quando o browser não decodifica a foto (ex.: HEIC). */
export function attachedPlaceholderDataUrl(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="800" viewBox="0 0 640 800">
    <rect width="640" height="800" fill="#E8F5EE"/>
    <rect x="100" y="240" width="440" height="320" rx="28" fill="#047857"/>
    <text x="320" y="380" text-anchor="middle" fill="#fff" font-family="system-ui,sans-serif" font-size="40" font-weight="700">Foto anexada</text>
    <text x="320" y="440" text-anchor="middle" fill="#D1FAE5" font-family="system-ui,sans-serif" font-size="22">pronta para o avatar</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
