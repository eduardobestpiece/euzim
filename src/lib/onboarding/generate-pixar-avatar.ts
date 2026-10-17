/**
 * Gera folhas de personagem estilo Walt Disney / Pixar a partir das fotos
 * de referência do onboarding (OpenAI gpt-image-2 + input images).
 */
import sharp from "sharp";
import type { OnboardingPhotoDraft } from "@/lib/auth/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-2";
const MAX_REFS = 6;
const REF_MAX_EDGE = 1024;

export type PixarEngine = "gpt-image-2";

export type PixarSheetKind = "child-face" | "child-body" | "friend";

export type PixarGenerationResult = {
  /** URL pública (Storage) ou data URL do hero/preview principal */
  url: string;
  faceSheetUrl?: string;
  bodySheetUrl?: string;
  engine: PixarEngine;
};

function apiKey(): string | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  return key || null;
}

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 100) return null;
    return buf;
  } catch {
    return null;
  }
}

async function prepareRefJpeg(bytes: Buffer): Promise<Buffer> {
  return sharp(bytes, { failOn: "none" })
    .rotate()
    .resize({
      width: REF_MAX_EDGE,
      height: REF_MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
}

function pickReferenceUrls(
  photos: OnboardingPhotoDraft[],
  slotPrefix: "face" | "body" | "any",
): string[] {
  const preferredOrder =
    slotPrefix === "face"
      ? [
          "face-front",
          "face-three_quarter_right",
          "face-three_quarter_left",
          "face-profile_right",
          "face-profile_left",
          "face-back",
        ]
      : slotPrefix === "body"
        ? [
            "body-front",
            "body-three_quarter_right",
            "body-three_quarter_left",
            "body-profile_right",
            "body-profile_left",
            "body-back",
          ]
        : [];

  const bySlot = new Map(
    photos
      .filter((p) => p.publicUrl || p.previewUrl?.startsWith("http"))
      .map((p) => [p.slotId, p.publicUrl || p.previewUrl] as const),
  );

  const urls: string[] = [];
  for (const id of preferredOrder) {
    const u = bySlot.get(id);
    if (u) urls.push(u);
  }
  if (urls.length === 0) {
    for (const p of photos) {
      const u = p.publicUrl || (p.previewUrl?.startsWith("http") ? p.previewUrl : "");
      if (u) urls.push(u);
    }
  }
  return urls.slice(0, MAX_REFS);
}

function faceSheetPrompt(name: string): string {
  return [
    `Create a Walt Disney / Pixar-quality 3D animated CHARACTER STUDY turnaround sheet of THIS exact child named "${name}" from the reference photos.`,
    `Preserve her/his real facial features, hair color and style, eye color, skin tone, and expression identity from the references with high fidelity.`,
    `Layout: a clean 2x3 grid on a neutral off-white studio background showing ONLY head-and-shoulders portraits in these angles:`,
    `1) front facing camera, 2) three-quarter facing viewer-right, 3) three-quarter facing viewer-left, 4) full profile right, 5) full profile left, 6) back of head / nape.`,
    `Soft cinematic lighting, consistent character model across all six panels, wholesome family-friendly, no adult themes.`,
    `Small Portuguese labels allowed: "ESTUDO DE PERSONAGEM" / "TURN-AROUND". No watermark, no logo, no extra people.`,
  ].join(" ");
}

function bodySheetPrompt(name: string): string {
  return [
    `Create a Walt Disney / Pixar-quality 3D animated full-body CHARACTER STUDY turnaround of THIS exact child named "${name}" from the reference photos.`,
    `Same identity as the face references: preserve hair, face, body proportions, and clothing vibe from the photos.`,
    `Layout: clean 2x3 grid on neutral off-white background, FULL BODY (head to feet), barefoot or simple shoes, in angles:`,
    `1) profile right, 2) three-quarter right, 3) three-quarter right eyes closed or gentle smile variant, 4) front, 5) three-quarter left smiling, 6) three-quarter back looking over shoulder.`,
    `Soft studio lighting, consistent Pixar character across panels, wholesome. Labels "ESTUDO DE PERSONAGEM" / "TURN-AROUND" ok. No watermark.`,
  ].join(" ");
}

function friendSheetPrompt(name: string, kind: "pet" | "toy"): string {
  if (kind === "pet") {
    return [
      `Create a Walt Disney / Pixar-quality 3D animated CHARACTER STUDY turnaround of THIS exact pet named "${name}" from the reference photos.`,
      `Preserve colors, markings, shape, and distinctive details from the references with high fidelity.`,
      `Layout: clean 2x3 grid on neutral light-grey/off-white background showing the full character in six angles (front, 3/4 right, profile right, 3/4 left, 3/4 back, back).`,
      `Soft cinematic 3D materials, studio lighting, consistent model across panels, wholesome kids style.`,
      `No text except optional "ESTUDO DE PERSONAGEM" / "TURN-AROUND". No watermark. No people.`,
    ].join(" ");
  }
  return [
    `Create a Pixar-style 3D cartoon toy sidekick turnaround sheet named "${name}" inspired by the colorful plastic toys in the reference photos.`,
    `Preserve distinctive colors, shapes, and markings. Layout: clean 2x3 grid of full-body angles on light background.`,
    `Soft studio lighting, wholesome kids movie style, consistent model across panels.`,
    `Optional label "ESTUDO DE PERSONAGEM". No watermark, no people, no realistic humans.`,
  ].join(" ");
}

function heroPortraitPrompt(name: string, kind: "child" | "pet" | "toy"): string {
  if (kind === "child") {
    return [
      `Create a single Walt Disney / Pixar 3D animated bust portrait of THIS exact child named "${name}" from the reference photos.`,
      `Preserve facial features, hair, eyes, and smile. Soft cinematic lighting, clean pastel magical background, friendly expression, family-friendly.`,
      `No text, no watermark, no extra people.`,
    ].join(" ");
  }
  if (kind === "pet") {
    return [
      `Create a single Walt Disney / Pixar 3D animated hero portrait of THIS exact pet named "${name}" from the reference photos.`,
      `Preserve distinctive colors and shape. Soft studio lighting, wholesome kids style, clean background. No text, no watermark, no people.`,
    ].join(" ");
  }
  return [
    `Transform the colorful toys in the reference photos into a single cute Walt Disney / Pixar 3D animated toy sidekick character named "${name}".`,
    `Wholesome kids movie style, soft studio lighting, clean pastel background, friendly and playful. Family-safe.`,
    `No text, no watermark, no people, no realistic humans.`,
  ].join(" ");
}

async function callImageEdit(input: {
  prompt: string;
  images: Buffer[];
  size?: "1024x1024" | "1024x1536" | "1536x1024";
  quality?: "low" | "medium" | "high";
}): Promise<Buffer> {
  const key = apiKey();
  if (!key) throw new Error("OPENAI_API_KEY ausente.");

  const form = new FormData();
  form.set("model", IMAGE_MODEL);
  form.set("prompt", input.prompt);
  form.set("size", input.size || "1024x1024");
  form.set("quality", input.quality || "medium");
  form.set("output_format", "jpeg");
  // gpt-image-2 always high fidelity; gpt-image-1 accepts input_fidelity
  if (IMAGE_MODEL.includes("gpt-image-1")) {
    form.set("input_fidelity", "high");
  }

  input.images.forEach((buf, i) => {
    const file = new File([new Uint8Array(buf)], `ref-${i}.jpg`, {
      type: "image/jpeg",
    });
    form.append("image[]", file);
  });

  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
    signal: AbortSignal.timeout(180_000),
  });

  const json = (await res.json()) as {
    error?: { message?: string };
    data?: { b64_json?: string; url?: string }[];
  };

  if (!res.ok) {
    throw new Error(json.error?.message || `OpenAI images/edits ${res.status}`);
  }

  const b64 = json.data?.[0]?.b64_json;
  if (b64) return Buffer.from(b64, "base64");

  const url = json.data?.[0]?.url;
  if (url) {
    const remote = await fetchImageBuffer(url);
    if (remote) return remote;
  }
  throw new Error("Resposta da OpenAI sem imagem.");
}

/** Retenta com prompts alternativos quando o filtro de segurança rejeita brinquedos. */
async function callImageEditWithSafetyFallback(input: {
  prompts: string[];
  images: Buffer[];
  size?: "1024x1024" | "1024x1536" | "1536x1024";
  quality?: "low" | "medium" | "high";
}): Promise<Buffer> {
  let lastError: Error | null = null;
  for (const prompt of input.prompts) {
    try {
      return await callImageEdit({
        prompt,
        images: input.images,
        size: input.size,
        quality: input.quality,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      lastError = err instanceof Error ? err : new Error(message);
      if (!/safety|rejected/i.test(message)) throw lastError;
    }
  }
  throw lastError ?? new Error("Falha ao gerar imagem.");
}

async function uploadGeneratedJpeg(input: {
  userId: string;
  filename: string;
  jpeg: Buffer;
}): Promise<string> {
  if (!isSupabaseConfigured()) {
    return `data:image/jpeg;base64,${input.jpeg.toString("base64")}`;
  }
  const db = createAdminClient() ?? (await createClient());
  if (!db) {
    return `data:image/jpeg;base64,${input.jpeg.toString("base64")}`;
  }
  const path = `${input.userId}/generated/${input.filename}`;
  const { error } = await db.storage.from("avatars").upload(path, input.jpeg, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (error) {
    return `data:image/jpeg;base64,${input.jpeg.toString("base64")}`;
  }
  const { data } = db.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}

async function loadPreparedRefs(urls: string[]): Promise<Buffer[]> {
  const out: Buffer[] = [];
  for (const url of urls) {
    const raw = await fetchImageBuffer(url);
    if (!raw) continue;
    try {
      out.push(await prepareRefJpeg(raw));
    } catch {
      /* skip bad ref */
    }
    if (out.length >= MAX_REFS) break;
  }
  return out;
}

/**
 * Gera hero + folhas Pixar para a criança (rosto e, se possível, corpo).
 */
export async function generateChildPixarAvatars(input: {
  userId: string;
  name: string;
  photos: OnboardingPhotoDraft[];
}): Promise<PixarGenerationResult> {
  const faceUrls = pickReferenceUrls(input.photos, "face");
  const bodyUrls = pickReferenceUrls(input.photos, "body");
  const faceRefs = await loadPreparedRefs(
    faceUrls.length ? faceUrls : pickReferenceUrls(input.photos, "any"),
  );

  if (!apiKey()) {
    throw new Error("OPENAI_API_KEY ausente — não dá para gerar Pixar.");
  }
  if (faceRefs.length === 0) {
    throw new Error(
      "Não consegui baixar as fotos de referência da criança. Reenvie as fotos e tente de novo.",
    );
  }

  // 1) Hero portrait (preview card)
  const heroJpeg = await callImageEdit({
    prompt: heroPortraitPrompt(input.name, "child"),
    images: faceRefs.slice(0, 3),
    size: "1024x1024",
    quality: "medium",
  });
  const heroUrl = await uploadGeneratedJpeg({
    userId: input.userId,
    filename: `child-hero-${Date.now()}.jpg`,
    jpeg: heroJpeg,
  });

  // 2) Face turnaround sheet
  let faceSheetUrl: string | undefined;
  try {
    const sheet = await callImageEdit({
      prompt: faceSheetPrompt(input.name),
      images: faceRefs,
      size: "1536x1024",
      quality: "medium",
    });
    faceSheetUrl = await uploadGeneratedJpeg({
      userId: input.userId,
      filename: `child-face-sheet-${Date.now()}.jpg`,
      jpeg: sheet,
    });
  } catch {
    faceSheetUrl = undefined;
  }

  // 3) Body turnaround (best-effort)
  let bodySheetUrl: string | undefined;
  const bodyRefs = await loadPreparedRefs(
    bodyUrls.length ? bodyUrls : faceUrls,
  );
  if (bodyRefs.length) {
    try {
      const sheet = await callImageEdit({
        prompt: bodySheetPrompt(input.name),
        images: bodyRefs,
        size: "1536x1024",
        quality: "medium",
      });
      bodySheetUrl = await uploadGeneratedJpeg({
        userId: input.userId,
        filename: `child-body-sheet-${Date.now()}.jpg`,
        jpeg: sheet,
      });
    } catch {
      bodySheetUrl = undefined;
    }
  }

  return {
    url: heroUrl,
    faceSheetUrl,
    bodySheetUrl,
    engine: "gpt-image-2",
  };
}

export async function generateFriendPixarAvatar(input: {
  userId: string;
  name: string;
  kind: "pet" | "toy";
  photos: OnboardingPhotoDraft[];
}): Promise<PixarGenerationResult> {
  const urls = pickReferenceUrls(input.photos, "any");
  const refs = await loadPreparedRefs(urls);

  if (!apiKey()) {
    throw new Error("OPENAI_API_KEY ausente — não dá para gerar Pixar.");
  }
  if (refs.length === 0) {
    throw new Error(
      "Não consegui baixar as fotos de referência do amigo. Reenvie as 6 fotos de corpo e tente de novo.",
    );
  }

  const heroJpeg = await callImageEditWithSafetyFallback({
    prompts:
      input.kind === "toy"
        ? [
            heroPortraitPrompt(input.name, "toy"),
            `Create a Pixar-style 3D cartoon mascot inspired by the colorful toys in the photos. Character name vibe: "${input.name}". Soft lighting, cute proportions, children's storybook character, clean background. No people, no text.`,
          ]
        : [heroPortraitPrompt(input.name, input.kind)],
    images: refs.slice(0, 4),
    size: "1024x1024",
    quality: "medium",
  });
  const heroUrl = await uploadGeneratedJpeg({
    userId: input.userId,
    filename: `friend-hero-${Date.now()}.jpg`,
    jpeg: heroJpeg,
  });

  let faceSheetUrl: string | undefined;
  try {
    const sheet = await callImageEditWithSafetyFallback({
      prompts: [
        friendSheetPrompt(input.name, input.kind),
        `Create a Pixar-style 3D cartoon toy robot character turnaround sheet named "${input.name}" based on the colorful toys in the references. 2x3 grid of full-body angles, soft lighting, kids movie style, clean background. No people, no text except ESTUDO DE PERSONAGEM.`,
      ],
      images: refs,
      size: "1536x1024",
      quality: "medium",
    });
    faceSheetUrl = await uploadGeneratedJpeg({
      userId: input.userId,
      filename: `friend-sheet-${Date.now()}.jpg`,
      jpeg: sheet,
    });
  } catch {
    faceSheetUrl = undefined;
  }

  return {
    url: heroUrl,
    faceSheetUrl,
    engine: "gpt-image-2",
  };
}

export { isPixarGeneratedUrl } from "@/lib/onboarding/pixar-url";
