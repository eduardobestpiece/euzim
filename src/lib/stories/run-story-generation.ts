import { MONTHLY_STORY_LIMIT } from "@/lib/billing/character-packs";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { generateStoryPipeline } from "@/lib/stories/generate-pipeline";
import { generateStoryPageImages } from "@/lib/stories/generate-story-images";
import { generateStoryQuiz } from "@/lib/stories/generate-story-quiz";
import { loadStoryCast } from "@/lib/stories/story-cast";
import {
  LANGUAGE_LEVELS,
  STORY_TYPES,
  WORD_VOLUME_TARGETS,
  type LanguageLevel,
  type StoryType,
  type WordVolume,
} from "@/lib/stories/storyteller-skill";
import { PLATFORM_BUILD } from "@/lib/platform-build";
import {
  readMockStories,
  writeMockStories,
  type MockStoryRecord,
} from "@/lib/stories/mock-store";

export type GeneratePayload = {
  theme: string;
  storyType?: StoryType;
  wordVolume?: WordVolume;
  wordTarget?: number;
  languageLevel?: LanguageLevel;
  christianValues?: boolean;
  answers?: Record<string, string>;
  characterIds?: string[];
  protagonistId?: string;
};

export type GenerateResult = {
  ok: boolean;
  error?: string;
  storyId?: string;
  shareToken?: string | null;
  title?: string;
  pages?: number;
  quizCount?: number;
  redirectTo?: string;
  persistedTo?: string;
  engine?: string;
};

function isStoryType(v: string): v is StoryType {
  return (STORY_TYPES as readonly string[]).includes(v);
}

function isWordVolume(v: string): v is WordVolume {
  return v === "curta" || v === "media" || v === "longa";
}

function isLanguageLevel(v: string): v is LanguageLevel {
  return (LANGUAGE_LEVELS as readonly string[]).includes(v);
}

export function parseGeneratePayload(body: Record<string, unknown>): {
  payload?: GeneratePayload;
  error?: string;
} {
  const theme = String(body.theme ?? "").trim();
  if (!theme) return { error: "Escolha um tema ou desejo para a história." };

  const payload: GeneratePayload = { theme };
  if (typeof body.storyType === "string" && isStoryType(body.storyType)) {
    payload.storyType = body.storyType;
  }
  if (typeof body.wordVolume === "string" && isWordVolume(body.wordVolume)) {
    payload.wordVolume = body.wordVolume;
    payload.wordTarget = WORD_VOLUME_TARGETS[body.wordVolume].words;
  }
  if (typeof body.wordTarget === "number" && body.wordTarget > 0) {
    payload.wordTarget = Math.round(body.wordTarget);
  }
  if (
    typeof body.languageLevel === "string" &&
    isLanguageLevel(body.languageLevel)
  ) {
    payload.languageLevel = body.languageLevel;
  }
  if (typeof body.christianValues === "boolean") {
    payload.christianValues = body.christianValues;
  }
  if (body.answers && typeof body.answers === "object") {
    payload.answers = Object.fromEntries(
      Object.entries(body.answers as Record<string, unknown>).map(([k, v]) => [
        k,
        String(v),
      ]),
    );
  }
  if (Array.isArray(body.characterIds)) {
    payload.characterIds = body.characterIds.map(String);
  }
  if (body.protagonistId) payload.protagonistId = String(body.protagonistId);
  return { payload };
}

/** Executa o pipeline completo e persiste a história. */
export async function runStoryGeneration(input: {
  userId: string;
  payload: GeneratePayload;
  onProgress?: (msg: string) => Promise<void> | void;
}): Promise<GenerateResult> {
  const { userId, payload } = input;
  const theme = payload.theme;
  const notify = async (msg: string) => {
    try {
      await input.onProgress?.(msg);
    } catch {
      /* ignore */
    }
  };

  await notify("Preparando o elenco…");
  const cast = await loadStoryCast(userId);
  if (!cast) {
    return {
      ok: false,
      error: "Cadastre a criança no onboarding antes de gerar.",
    };
  }

  let castNames: string[] | undefined;
  let protagonistName: string | undefined;
  const adminForChars = createAdminClient() ?? (await createClient());
  if (adminForChars && payload.characterIds?.length) {
    const { data: chars } = await adminForChars
      .from("characters")
      .select("id, name, is_primary")
      .eq("parent_id", userId)
      .in("id", payload.characterIds);
    castNames = (chars ?? []).map((c) => c.name);
    const protag = (chars ?? []).find((c) => c.id === payload.protagonistId);
    if (protag) protagonistName = protag.name;
    else if ((chars ?? []).some((c) => c.is_primary)) {
      protagonistName = (chars ?? []).find((c) => c.is_primary)?.name;
    }
  }
  if (!protagonistName) protagonistName = cast.childName;

  await notify("Contador Sábio escrevendo…");
  const { story: drafted, pipeline, engine } = await generateStoryPipeline({
    cast,
    theme,
    options: {
      userId,
      storyType: payload.storyType,
      wordTarget: payload.wordTarget,
      wordVolume: payload.wordVolume,
      languageLevel: payload.languageLevel,
      christianValues: payload.christianValues,
      clarifyAnswers: payload.answers,
      castNames,
      protagonistName,
    },
  });

  if (engine === "mock-v1") {
    return {
      ok: false,
      error:
        "Não consegui gerar com a IA agora. Confira OPENAI_API_KEY e tente de novo.",
    };
  }

  const storyKey = crypto.randomUUID();
  let pages = drafted.pages;
  await notify("Pintando cenas Pixar…");
  try {
    pages = await generateStoryPageImages({
      userId,
      storyKey,
      storyTitle: drafted.title,
      cast,
      pages: drafted.pages,
    });
  } catch {
    /* texto permanece */
  }

  const withImages = pages.filter((p) => p.imageUrl).length;
  if (withImages === 0) {
    return {
      ok: false,
      error:
        "A história foi escrita, mas as imagens Pixar falharam. Tente novamente.",
    };
  }

  const coverImageUrl =
    pages.find((p) => p.imageUrl)?.imageUrl || drafted.coverImageUrl || null;

  const textContent = {
    ...drafted.textContent,
    moral: pipeline.moral || drafted.textContent.moral,
    reviewNotes: pipeline.reviewNotes,
    fullText: pipeline.fullText || drafted.textContent.fullText,
    pages: pages.map((p) => ({
      index: p.pageIndex,
      title: p.chapterTitle,
      text: p.text,
      image_prompt: p.imagePrompt,
    })),
  };

  await notify("Criando o quiz inteligente…");
  const questionsData = await generateStoryQuiz({
    userId,
    title: drafted.title,
    moral: pipeline.moral,
    fullText: pipeline.fullText || "",
    pages: pages.map((p) => ({
      title: p.chapterTitle,
      text: p.text,
    })),
  });

  const admin = createAdminClient();
  const userClient = await createClient();
  const db = admin ?? userClient;

  if (db && cast.childId !== "mock-child") {
    try {
      const { data: story, error: storyError } = await db
        .from("stories")
        .insert({
          parent_id: userId,
          child_id: cast.childId,
          character_id: cast.characterId,
          title: drafted.title,
          status: "ready",
          is_public: true,
          text_content: textContent,
          questions_data: questionsData,
          cover_image_url: coverImageUrl,
          template_id: pipeline.templateId ?? null,
          generation_meta: {
            engine,
            theme,
            storyType: payload.storyType ?? null,
            wordTarget: payload.wordTarget ?? null,
            wordVolume: payload.wordVolume ?? null,
            languageLevel: payload.languageLevel ?? null,
            christianValues: Boolean(payload.christianValues),
            pages: pages.length,
            quizCount: questionsData.length,
            pipeline: "outline-expand-split-bible-pixar-quiz",
            fromTemplate: Boolean(pipeline.fromTemplate),
            templateId: pipeline.templateId ?? null,
            friend: { name: cast.friendName, kind: cast.friendKind },
            moral: pipeline.moral,
            stamp: PLATFORM_BUILD,
            auxModel: "gpt-4o-mini",
            textModel: process.env.OPENAI_STORY_MODEL?.trim() || "gpt-4o",
          },
          published_at: new Date().toISOString(),
        })
        .select("id, share_token")
        .single();

      if (!storyError && story?.id) {
        const imageRows = pages.map((p) => ({
          story_id: story.id,
          parent_id: userId,
          page_index: p.pageIndex,
          image_url: p.imageUrl || coverImageUrl || "",
          alt_text: p.altText,
          prompt_used: p.imagePrompt || `${engine}:page:${p.pageIndex}`,
        }));
        await db.from("story_images").insert(imageRows);
        await db
          .from("users")
          .update({ last_story_at: new Date().toISOString() })
          .eq("id", userId);

        return {
          ok: true,
          storyId: story.id,
          shareToken: story.share_token,
          persistedTo: "supabase",
          engine,
          title: drafted.title,
          pages: pages.length,
          quizCount: questionsData.length,
          redirectTo: `/app/parent/stories/${story.id}`,
        };
      }
    } catch {
      /* mock fallback */
    }
  }

  const record: MockStoryRecord = {
    id: storyKey,
    parentId: userId,
    childId: cast.childId,
    title: drafted.title,
    status: "ready",
    textContent,
    coverImageUrl: coverImageUrl || "",
    pages,
    questionsData,
    createdAt: new Date().toISOString(),
  };
  const existing = await readMockStories();
  await writeMockStories([record, ...existing]);

  return {
    ok: true,
    storyId: record.id,
    shareToken: record.id,
    persistedTo: "mock",
    engine,
    title: drafted.title,
    pages: pages.length,
    quizCount: questionsData.length,
    redirectTo: `/app/parent/stories/${record.id}`,
  };
}

export { MONTHLY_STORY_LIMIT };
