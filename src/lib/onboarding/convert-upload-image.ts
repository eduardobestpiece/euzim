import sharp from "sharp";

const MAX_EDGE = 1600;
const JPEG_QUALITY = 82;

/**
 * Converte qualquer buffer de imagem para JPEG leve (servidor).
 * Fallback: devolve o original se sharp não conseguir ler (ex.: HEIC sem lib).
 */
export async function convertUploadToJpeg(bytes: Buffer): Promise<{
  buffer: Buffer;
  contentType: "image/jpeg";
  ext: "jpg";
  converted: boolean;
  /** Preview pequeno (data URL) para o cliente exibir na hora. */
  previewDataUrl?: string;
}> {
  try {
    const buffer = await sharp(bytes, { failOn: "none" })
      .rotate()
      .resize({
        width: MAX_EDGE,
        height: MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer();

    const thumb = await sharp(buffer)
      .resize({ width: 480, height: 600, fit: "cover" })
      .jpeg({ quality: 72 })
      .toBuffer();

    return {
      buffer,
      contentType: "image/jpeg",
      ext: "jpg",
      converted: true,
      previewDataUrl: `data:image/jpeg;base64,${thumb.toString("base64")}`,
    };
  } catch {
    return {
      buffer: bytes,
      contentType: "image/jpeg",
      ext: "jpg",
      converted: false,
    };
  }
}
