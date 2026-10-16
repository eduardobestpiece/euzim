/** Reduz foto de celular antes do upload (Server Actions / Storage). */

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;
const TARGET_BYTES = 900_000;

export async function compressImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  // Já pequeno o bastante — mantém original
  if (file.size <= TARGET_BYTES && file.size < 1_000_000) return file;

  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);

    let quality = JPEG_QUALITY;
    let blob = await canvasToBlob(canvas, "image/jpeg", quality);
    while (blob && blob.size > 1_400_000 && quality > 0.55) {
      quality -= 0.08;
      blob = await canvasToBlob(canvas, "image/jpeg", quality);
    }
    if (!blob) return file;

    const base = file.name.replace(/\.[^.]+$/, "") || "foto";
    return new File([blob], `${base}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } finally {
    bitmap.close();
  }
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
