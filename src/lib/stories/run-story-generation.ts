import { MONTHLY_STORY_LIMIT } from "@/lib/billing/character-packs";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { generateStoryPipeline } from "@/lib/stories/generate-pipeline";
import { generateStoryPageImages } from "@/lib/stories/generate-story-images";
import { generateStoryQuiz } from "@/lib/stories/generate-story-quiz";
import { loadStoryCast, type CoPlayMember } from "@/lib/stories/story-cast";
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
import { insertStoryResilient } from "@/lib/stories/persist-helpers";
import { attachUsageToStory } from "@/lib/usage/openai-meter";
import { mergeUsageContext } from "@/lib/usage/usage-context";
import { loadCharactersByIdsForStory } from "@/lib/social/friend-cast";

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
  /** Conta amiga (users.id) cujo elenco pode entrar na história. */
  friendParentId?: string;
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
    payload.characterIds = body.characterIds.map(String).slice(0, 5);
  }
  if (body.protagonistId) payload.protagonistId = String(body.protagonistId);
  if (
    typeof body.friendParentId === "string" &&
    body.friendParentId.trim()
  ) {
    payload.friendParentId = body.friendParentId.trim();
  }
  return { payload };
}

function traitsSummary(traits: unknown, description?: string | null): string {
  const parts: string[] = [];
  if (description?.trim()) parts.push(description.trim());
  if (Array.isArray(traits)) {
    parts.push(traits.map(String).filter(Boolean).join(", "));
  } else if (traits && typeof traits === "object") {
    parts.push(JSON.stringify(traits).slice(0, 120));
  }
  return parts.filter(Boolean).join(" — ").slice(0, 200);
}

/** Executa o pipeline completo e persiste a história. */
export async function runStoryGeneration(input: {
  userId: string;
  payload: GeneratePayload;
  jobId?: string | null;
  onProgress?: (msg: string) => Promise<void> | void;
}): Promise<GenerateResult> {
  const { userId, payload } = input;
  const theme = payload.theme;
  const storyKey = crypto.randomUUID();
  mergeUsageContext({
    jobId: input.jobId ?? null,
    generationKey: storyKey,
  });
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
  let coPlayMembers: CoPlayMember[] = [];
  let guestCharacterIds: string[] = [];

  if (payload.characterIds?.length) {
    const selected = await loadCharactersByIdsForStory({
      userId,
      characterIds: payload.characterIds,
      friendParentId: payload.friendParentId ?? null,
    });
    castNames = selected.map((c) => c.name);
    coPlayMembers = selected.map((c) => ({
      id: c.id,
      name: c.name,
      avatarUrl: c.avatarUrl ?? null,
      parentId: c.parentId,
      source: c.source,
      traitsSummary: traitsSummary(c.traits, c.description),
      kind: c.kind,
      isPrimary: c.isPrimary,
    }));
    guestCharacterIds = selected
      .filter((c) => c.source === "friend")
      .map((c) => c.id);
    const protag = selected.find((c) => c.id === payload.protagonistId);
    if (protag) protagonistName = protag.name;
    else {
      const primaryOwn = selected.find(
        (c) => c.source === "own" && c.isPrimary,
      );
      protagonistName = primaryOwn?.name ?? selected[0]?.name;
    }
    cast.coPlayMembers = coPlayMembers;
    cast.friendParentId = payload.friendParentId ?? null;
  }
  if (!protagonistName) protagonistName = cast.childName;

  await notify("Contador Sábio escrevendo…");
  const { story: drafted, pipeline, engine, error: pipelineError } =
    await generateStoryPipeline({
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
        pipelineError ||
        "Não consegui gerar com a IA agora. Tente de novo em instantes.",
    };
  }

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
      const { data: story, error: storyError } = await insertStoryResilient(db, {
        parent_id: userId,
        child_id: cast.childId,
        character_id: cast.characterId,
        title: drafted.title,
        status: "ready",
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
          friend: {
            name: cast.friendName,
            kind: cast.friendKind,
            gender: cast.friendGender,
          },
          characterIds: payload.characterIds ?? [],
          guestCharacterIds,
          friendParentId: payload.friendParentId ?? null,
          coPlayNames: castNames ?? [],
          moral: pipeline.moral,
          stamp: PLATFORM_BUILD,
          auxModel: "gpt-4o-mini",
          textModel: process.env.OPENAI_STORY_MODEL?.trim() || "gpt-4o",
          jobId: input.jobId ?? null,
          generationKey: storyKey,
        },
        published_at: new Date().toISOString(),
      });

      if (!storyError && story?.id) {
        mergeUsageContext({ storyId: story.id });
        const costs = await attachUsageToStory({
          userId,
          storyId: story.id,
          jobId: input.jobId ?? null,
          generationKey: storyKey,
        });
        await db
          .from("stories")
          .update({
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
              friend: {
                name: cast.friendName,
                kind: cast.friendKind,
                gender: cast.friendGender,
              },
              characterIds: payload.characterIds ?? [],
              guestCharacterIds,
              friendParentId: payload.friendParentId ?? null,
              coPlayNames: castNames ?? [],
              moral: pipeline.moral,
              stamp: PLATFORM_BUILD,
              auxModel: "gpt-4o-mini",
              textModel: process.env.OPENAI_STORY_MODEL?.trim() || "gpt-4o",
              jobId: input.jobId ?? null,
              generationKey: storyKey,
              estimatedUsd: costs.usd,
              estimatedBrl: costs.brl,
            },
          })
          .eq("id", story.id);

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
