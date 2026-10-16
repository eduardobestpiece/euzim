/** Reduz foto de celular para JPEG leve antes do upload. */

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;
const TARGET_BYTES = 900_000;

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|heic|heif|bmp|avif)$/i;

function looksLikeImage(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  // iOS / alguns apps enviam type vazio
  return IMAGE_EXT.test(file.name) || file.type === "";
}

export async function compressImageForUpload(file: File): Promise<File> {
  if (!looksLikeImage(file)) {
    throw new Error("Envie uma imagem (JPG, PNG ou da galeria do celular).");
  }

  // Já JPEG pequeno — mantém
  if (
    file.type === "image/jpeg" &&
    file.size <= TARGET_BYTES &&
    file.size > 0
  ) {
    return file;
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
        throw new Error("Não foi possível processar a imagem neste navegador.");
      }
      ctx.drawImage(bitmap, 0, 0, width, height);

      let quality = JPEG_QUALITY;
      let blob = await canvasToBlob(canvas, "image/jpeg", quality);
      while (blob && blob.size > 1_400_000 && quality > 0.55) {
        quality -= 0.08;
        blob = await canvasToBlob(canvas, "image/jpeg", quality);
      }
      if (!blob) {
        throw new Error("Falha ao converter a foto para JPEG.");
      }

      const base = file.name.replace(/\.[^.]+$/, "") || "foto";
      return new File([blob], `${base}.jpg`, {
        type: "image/jpeg",
        lastModified: Date.now(),
      });
    } finally {
      bitmap.close();
    }
  } catch (err) {
    // HEIC sem suporte no browser: deixa o servidor (sharp) converter
    if (file.size <= 12 * 1024 * 1024) {
      return file;
    }
    throw err instanceof Error
      ? err
      : new Error("Não foi possível preparar a foto.");
  }
}

async function decodeToBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file);
  } catch {
    // Fallback: <img> + object URL (útil para alguns PNG/WebP)
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
