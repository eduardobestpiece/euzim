import sharp from "sharp";
import type { GeneratedPage } from "@/lib/stories/generate-mock";
import type { StoryCast } from "@/lib/stories/story-cast";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  estimateImageUsd,
  recordUsageEvent,
} from "@/lib/usage/openai-meter";

const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-2";
const REF_EDGE = 1024;

function apiKey(): string | null {
  return process.env.OPENAI_API_KEY?.trim() || null;
}

async function fetchBuf(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length > 100 ? buf : null;
  } catch {
    return null;
  }
}

async function prepareJpeg(bytes: Buffer): Promise<Buffer> {
  return sharp(bytes, { failOn: "none" })
    .rotate()
    .resize({
      width: REF_EDGE,
      height: REF_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
}

async function loadRefs(cast: StoryCast): Promise<Buffer[]> {
  const urls = [
    cast.childHeroUrl,
    cast.friendHeroUrl,
    cast.childFaceSheetUrl,
    cast.friendSheetUrl,
    cast.childBodySheetUrl,
  ].filter((u): u is string => Boolean(u));

  const out: Buffer[] = [];
  for (const url of urls) {
    const raw = await fetchBuf(url);
    if (!raw) continue;
    try {
      out.push(await prepareJpeg(raw));
    } catch {
      /* skip */
    }
    if (out.length >= 4) break;
  }
  return out;
}

async function callImageEdit(
  prompt: string,
  images: Buffer[],
  userId?: string | null,
  pageIndex?: number,
): Promise<Buffer> {
  const key = apiKey();
  if (!key) throw new Error("OPENAI_API_KEY ausente.");

  const form = new FormData();
  form.set("model", IMAGE_MODEL);
  form.set("prompt", prompt);
  form.set("size", "1024x1024");
  form.set("quality", "medium");
  form.set("output_format", "jpeg");
  if (IMAGE_MODEL.includes("gpt-image-1")) {
    form.set("input_fidelity", "high");
  }
  images.forEach((buf, i) => {
    form.append(
      "image[]",
      new File([new Uint8Array(buf)], `ref-${i}.jpg`, { type: "image/jpeg" }),
    );
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
  await recordUsageEvent({
    userId,
    category: "story_image",
    model: IMAGE_MODEL,
    operation: "story_page_image",
    estimatedUsd: estimateImageUsd(IMAGE_MODEL, 1),
    meta: { pageIndex: pageIndex ?? null },
  });
  const b64 = json.data?.[0]?.b64_json;
  if (b64) return Buffer.from(b64, "base64");
  const url = json.data?.[0]?.url;
  if (url) {
    const remote = await fetchBuf(url);
    if (remote) return remote;
  }
  throw new Error("Resposta da OpenAI sem imagem.");
}

async function uploadStoryJpeg(input: {
  userId: string;
  storyKey: string;
  pageIndex: number;
  jpeg: Buffer;
}): Promise<string> {
  if (!isSupabaseConfigured()) {
    return `data:image/jpeg;base64,${input.jpeg.toString("base64")}`;
  }
  const db = createAdminClient() ?? (await createClient());
  if (!db) {
    return `data:image/jpeg;base64,${input.jpeg.toString("base64")}`;
  }
  const path = `${input.userId}/stories/${input.storyKey}/page-${input.pageIndex}.jpg`;
  const { error } = await db.storage.from("avatars").upload(path, input.jpeg, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (error) {
    return `data:image/jpeg;base64,${input.jpeg.toString("base64")}`;
  }
  return db.storage.from("avatars").getPublicUrl(path).data.publicUrl;
}

function scenePrompt(
  cast: StoryCast,
  page: GeneratedPage,
  storyTitle: string,
  pageIndex: number,
  totalPages: number,
): string {
  const base =
    page.imagePrompt?.trim() ||
    `Scene from the children's story "${storyTitle}"`;
  return [
    base,
    `This is beat ${pageIndex + 1} of ${totalPages} — do not repeat previous framing; match this beat exactly.`,
    `Walt Disney / Pixar quality 3D animated cinematic still.`,
    `Feature THIS exact child character "${cast.childName}" and THIS exact ${cast.friendKind} companion "${cast.friendName}" from the reference images as the clear protagonists.`,
    `Preserve their Pixar look, colors, and identity from the references with high fidelity.`,
    `Soft cinematic lighting, wholesome family-friendly mood, rich storybook composition.`,
    `No text, no captions, no watermark, no logos, no photorealistic humans.`,
  ].join(" ");
}

/**
 * Gera 1 imagem Pixar por página, com refs dos avatares.
 * Sequencial (mais estável com rate limits); páginas sem ref usam data URL vazia.
 */
export async function generateStoryPageImages(input: {
  userId: string;
  storyKey: string;
  storyTitle: string;
  cast: StoryCast;
  pages: GeneratedPage[];
  onProgress?: (done: number, total: number) => void;
}): Promise<GeneratedPage[]> {
  const refs = await loadRefs(input.cast);
  const out: GeneratedPage[] = [];

  for (let i = 0; i < input.pages.length; i++) {
    const page = input.pages[i];
    let imageUrl = page.imageUrl || "";
    try {
      if (apiKey() && refs.length > 0) {
        const jpeg = await callImageEdit(
          scenePrompt(
            input.cast,
            page,
            input.storyTitle,
            i,
            input.pages.length,
          ),
          refs.slice(0, 4),
          input.userId,
          page.pageIndex,
        );
        imageUrl = await uploadStoryJpeg({
          userId: input.userId,
          storyKey: input.storyKey,
          pageIndex: page.pageIndex,
          jpeg,
        });
      }
    } catch {
      // mantém vazio — UI ainda mostra o texto
    }
    out.push({ ...page, imageUrl });
    input.onProgress?.(i + 1, input.pages.length);
  }

  return out;
}
