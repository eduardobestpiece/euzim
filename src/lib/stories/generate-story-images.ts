import sharp from "sharp";
import type { GeneratedPage } from "@/lib/stories/generate-mock";
import type { StoryCast } from "@/lib/stories/story-cast";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  differenceHash,
  isNearDuplicate,
  shotForPage,
} from "@/lib/stories/image-hash";
import {
  hashPrompt,
  normalizePromptForHash,
} from "@/lib/stories/prompt-hash";
import {
  estimateImageUsd,
  recordUsageEvent,
} from "@/lib/usage/openai-meter";

const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-2";
/** Qualidade intermediária = custo↓ sem matar fidelidade dos avatares. */
const IMAGE_QUALITY =
  (process.env.OPENAI_IMAGE_QUALITY?.trim() as "low" | "medium" | "high") ||
  "low";
const REF_EDGE = 768;
const MAX_UNIQUENESS_RETRIES = 2;

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
    .jpeg({ quality: 82, mozjpeg: true })
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

async function findCachedImageUrl(
  userId: string,
  promptHash: string,
): Promise<string | null> {
  const db = createAdminClient() ?? (await createClient());
  if (!db) return null;
  try {
    const { data } = await db
      .from("story_images")
      .select("image_url, prompt_used")
      .eq("parent_id", userId)
      .like("prompt_used", `ph:${promptHash}|%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const url = data?.image_url;
    return url && url.length > 8 ? url : null;
  } catch {
    return null;
  }
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
  form.set("quality", IMAGE_QUALITY);
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
  const qualityMul =
    IMAGE_QUALITY === "low" ? 0.5 : IMAGE_QUALITY === "high" ? 1.5 : 1;
  await recordUsageEvent({
    userId,
    category: "story_image",
    model: IMAGE_MODEL,
    operation: "story_page_image",
    estimatedUsd: estimateImageUsd(IMAGE_MODEL, 1) * qualityMul,
    meta: { pageIndex: pageIndex ?? null, quality: IMAGE_QUALITY },
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
  attempt?: number;
}): Promise<string> {
  if (!isSupabaseConfigured()) {
    return `data:image/jpeg;base64,${input.jpeg.toString("base64")}`;
  }
  const db = createAdminClient() ?? (await createClient());
  if (!db) {
    return `data:image/jpeg;base64,${input.jpeg.toString("base64")}`;
  }
  const suffix = input.attempt && input.attempt > 0 ? `-r${input.attempt}` : "";
  const path = `${input.userId}/stories/${input.storyKey}/page-${input.pageIndex}${suffix}.jpg`;
  const { error } = await db.storage.from("avatars").upload(path, input.jpeg, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (error) {
    return `data:image/jpeg;base64,${input.jpeg.toString("base64")}`;
  }
  return db.storage.from("avatars").getPublicUrl(path).data.publicUrl;
}

function familyFaceRule(cast: StoryCast): string {
  if (cast.hasFamilyMemberAvatars) {
    return `Parents or siblings may show faces ONLY if matching an uploaded family avatar reference; otherwise body-only.`;
  }
  return [
    `CRITICAL face privacy: any parent, mother, father, caregiver, sibling, brother, or sister`,
    `MUST be shown body-only — from behind, over-the-shoulder, cropped at shoulders, or face fully turned away / obscured.`,
    `Never invent identifiable faces for family adults or siblings.`,
    `Strangers in the background may be soft-focus without clear facial detail.`,
  ].join(" ");
}

function scenePrompt(
  cast: StoryCast,
  page: GeneratedPage,
  storyTitle: string,
  pageIndex: number,
  totalPages: number,
  previousSummaries: string[],
  retryBoost = 0,
): string {
  const base =
    page.imagePrompt?.trim() ||
    `Scene from the children's story "${storyTitle}"`;
  const shot = shotForPage(pageIndex + retryBoost);
  const avoid =
    previousSummaries.length > 0
      ? `Do NOT reuse these previous framings: ${previousSummaries.join(" | ")}.`
      : "";
  const uniqueness =
    retryBoost > 0
      ? `REGENERATION ${retryBoost}: previous result looked too similar — change LOCATION details, CAMERA ANGLE, POSE, and FOREGROUND OBJECTS dramatically while keeping the same story beat.`
      : "";

  // Continuity + wardrobe já vêm embutidos em page.imagePrompt (Scene Continuity Bible).
  const continuityHint = page.imagePrompt?.includes("CONTINUITY BEAT")
    ? "Obey CONTINUITY BEAT / WARDROBE OUTFIT / PROP LOCKS / MUST SHOW / MUST NOT SHOW from the prompt above."
    : "";
  const wardrobeHint = page.imagePrompt?.includes("WARDROBE OUTFIT")
    ? [
        `WARDROBE RULE: dress "${cast.childName}" in the WARDROBE OUTFIT specified for THIS act.`,
        `Reference images are for FACE, HAIR, BODY SHAPE and Pixar identity ONLY — do NOT copy the default shirt/clothes from the turnaround sheet.`,
        `If the story beat is park/outdoors, use outdoor clothes (and hat if locked); if bedtime, pajamas; if visits/snack, a different casual outfit — clothing must match the scene text.`,
      ].join(" ")
    : [
        `WARDROBE RULE: clothing must match this story beat/scene, not the default outfit on the avatar reference sheet.`,
        `Use references only for face, hair, and body identity.`,
      ].join(" ");

  return [
    base,
    continuityHint,
    wardrobeHint,
    `Mandatory camera: ${shot}.`,
    `This is beat ${pageIndex + 1} of ${totalPages} — unique composition required.`,
    avoid,
    uniqueness,
    `Walt Disney / Pixar quality 3D animated cinematic still.`,
    `Feature THIS exact child character "${cast.childName}" and THIS exact ${cast.friendKind} companion "${cast.friendName}" from the reference images as the clear protagonists.`,
    `Preserve Pixar face, hair, skin tone, and body identity from the references with high fidelity.`,
    `Do NOT lock clothing to the reference sheet blouse — change outfit when the story context changes.`,
    `Do not invent avatar face/hair details that contradict the reference sheets.`,
    familyFaceRule(cast),
    pageIndex === totalPages - 1
      ? `Final beat: prefer a rich closing scene when the text allows (park, snack, joy, companions) — avoid only a bed close-up if the story covers more; outfit should match that closing context.`
      : "",
    `Soft cinematic lighting, wholesome family-friendly mood, rich storybook composition.`,
    `No text, no captions, no watermark, no logos, no photorealistic humans.`,
  ]
    .filter(Boolean)
    .join(" ");
}

export function promptUsedTag(promptHash: string, prompt: string): string {
  return `ph:${promptHash}|${prompt.slice(0, 240)}`;
}

/**
 * Gera 1 imagem Pixar por página (qualidade intermediária).
 * Reusa URL se hash de prompt idêntico; rejeita quase-duplicatas via dHash.
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
  const hashes: string[] = [];
  const framingNotes: string[] = [];
  const names = [input.cast.childName, input.cast.friendName];

  for (let i = 0; i < input.pages.length; i++) {
    const page = input.pages[i];
    let imageUrl = page.imageUrl || "";
    let promptUsed = "";
    try {
      if (apiKey() && refs.length > 0) {
        const basePrompt = scenePrompt(
          input.cast,
          page,
          input.storyTitle,
          i,
          input.pages.length,
          framingNotes,
          0,
        );
        const ph = hashPrompt(normalizePromptForHash(basePrompt, names));

        // Cache: prompt hash idêntico → reusa URL (sem nova chamada OpenAI)
        const cached = await findCachedImageUrl(input.userId, ph);
        if (cached) {
          // Ainda checa dHash visual se já temos bytes… mas só temos URL.
          // Evita reuso se a mesma URL já foi usada nesta história (anti-repeat).
          const alreadyInStory = out.some((p) => p.imageUrl === cached);
          if (!alreadyInStory) {
            imageUrl = cached;
            promptUsed = promptUsedTag(ph, basePrompt);
            framingNotes.push(`beat${i + 1}:cache-hit`);
            out.push({
              ...page,
              imageUrl,
              imagePrompt: page.imagePrompt
                ? `${promptUsed} :: ${page.imagePrompt}`
                : promptUsed,
            });
            input.onProgress?.(i + 1, input.pages.length);
            continue;
          }
        }

        let jpeg: Buffer | null = null;
        let chosenHash = "";
        let usedPrompt = basePrompt;
        for (let attempt = 0; attempt <= MAX_UNIQUENESS_RETRIES; attempt++) {
          const prompt = scenePrompt(
            input.cast,
            page,
            input.storyTitle,
            i,
            input.pages.length,
            framingNotes,
            attempt,
          );
          usedPrompt = prompt;
          const candidate = await callImageEdit(
            prompt,
            refs.slice(0, 4),
            input.userId,
            page.pageIndex,
          );
          const hash = await differenceHash(candidate);
          if (
            !isNearDuplicate(hash, hashes) ||
            attempt === MAX_UNIQUENESS_RETRIES
          ) {
            jpeg = candidate;
            chosenHash = hash;
            break;
          }
        }
        if (jpeg) {
          imageUrl = await uploadStoryJpeg({
            userId: input.userId,
            storyKey: input.storyKey,
            pageIndex: page.pageIndex,
            jpeg,
            attempt: hashes.length,
          });
          hashes.push(chosenHash);
          framingNotes.push(`beat${i + 1}:${shotForPage(i).slice(0, 48)}`);
          const finalHash = hashPrompt(
            normalizePromptForHash(usedPrompt, names),
          );
          promptUsed = promptUsedTag(finalHash, usedPrompt);
        }
      }
    } catch {
      // mantém vazio — UI ainda mostra o texto
    }
    out.push({
      ...page,
      imageUrl,
      imagePrompt: promptUsed
        ? `${promptUsed}${page.imagePrompt ? ` :: ${page.imagePrompt}` : ""}`
        : page.imagePrompt,
    });
    input.onProgress?.(i + 1, input.pages.length);
  }

  return out;
}
