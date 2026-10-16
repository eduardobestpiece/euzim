import convert from "heic-convert";
import sharp from "sharp";

const MAX_EDGE = 1600;
const JPEG_QUALITY = 82;

function isHeicBuffer(bytes: Buffer): boolean {
  if (bytes.length < 12) return false;
  // ISO BMFF: size(4) + 'ftyp' + brand
  if (bytes.toString("ascii", 4, 8) !== "ftyp") return false;
  const brand = bytes.toString("ascii", 8, 16).toLowerCase();
  return /heic|heif|mif1|msf1|hevx|hevc/.test(brand);
}

async function heicToJpegBuffer(bytes: Buffer): Promise<Buffer> {
  const out = await convert({
    buffer: bytes,
    format: "JPEG",
    quality: 0.85,
  });
  return Buffer.from(out);
}

/**
 * Converte qualquer buffer de imagem para JPEG leve (servidor).
 * HEIC/HEIF → heic-convert → sharp. Outros formatos → sharp direto.
 */
export async function convertUploadToJpeg(bytes: Buffer): Promise<{
  buffer: Buffer;
  contentType: "image/jpeg";
  ext: "jpg";
  converted: boolean;
  /** Preview pequeno (data URL) para o cliente exibir a foto real. */
  previewDataUrl?: string;
}> {
  let input = bytes;
  try {
    if (isHeicBuffer(bytes)) {
      input = await heicToJpegBuffer(bytes);
    }
  } catch {
    // Segue com bytes originais — sharp pode falhar e caímos no fallback
  }

  try {
    const buffer = await sharp(input, { failOn: "none" })
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
      .resize({ width: 640, height: 800, fit: "cover" })
      .jpeg({ quality: 78 })
      .toBuffer();

    return {
      buffer,
      contentType: "image/jpeg",
      ext: "jpg",
      converted: true,
      previewDataUrl: `data:image/jpeg;base64,${thumb.toString("base64")}`,
    };
  } catch {
    // Última tentativa: se heic-convert já gerou JPEG
    if (input !== bytes) {
      try {
        const thumb = await sharp(input)
          .resize({ width: 640, height: 800, fit: "cover" })
          .jpeg({ quality: 78 })
          .toBuffer();
        return {
          buffer: input,
          contentType: "image/jpeg",
          ext: "jpg",
          converted: true,
          previewDataUrl: `data:image/jpeg;base64,${thumb.toString("base64")}`,
        };
      } catch {
        /* fall through */
      }
    }
    return {
      buffer: bytes,
      contentType: "image/jpeg",
      ext: "jpg",
      converted: false,
    };
  }
}
