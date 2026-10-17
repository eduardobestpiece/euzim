import { NextResponse } from "next/server";
import { MONTHLY_STORY_LIMIT } from "@/lib/billing/character-packs";
import { getCurrentUser } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { generateStoryPipeline } from "@/lib/stories/generate-pipeline";
import { generateStoryPageImages } from "@/lib/stories/generate-story-images";
import { generateStoryQuiz } from "@/lib/stories/generate-story-quiz";
import { loadStoryCast } from "@/lib/stories/story-cast";
import {
  STORY_TYPES,
  WORD_VOLUME_TARGETS,
  type StoryType,
  type WordVolume,
} from "@/lib/stories/storyteller-skill";
import { PLATFORM_BUILD } from "@/lib/platform-build";
import {
  countMockStoriesThisMonth,
  readMockStories,
  writeMockStories,
  type MockStoryRecord,
} from "@/lib/stories/mock-store";
import { getStoryUsage } from "@/lib/stories/usage";
import { cookies } from "next/headers";

export const maxDuration = 300;

function isStoryType(v: string): v is StoryType {
  return (STORY_TYPES as readonly string[]).includes(v);
}

function isWordVolume(v: string): v is WordVolume {
  return v === "curta" || v === "media" || v === "longa";
}

/** Pipeline completo: rascunho → revisão → atos → imagens Pixar → quiz. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Faça login." }, { status: 401 });
  }

  let theme = "";
  let storyType: StoryType | undefined;
  let wordVolume: WordVolume | undefined;
  let wordTarget: number | undefined;
  let answers: Record<string, string> = {};
  let characterIds: string[] = [];
  let protagonistId: string | undefined;

  try {
    const body = (await request.json()) as {
      theme?: string;
      storyType?: string;
      wordTarget?: number;
      wordVolume?: string;
      answers?: Record<string, string>;
      characterIds?: string[];
      protagonistId?: string;
    };
    theme = String(body.theme ?? "").trim();
    if (body.storyType && isStoryType(body.storyType)) {
      storyType = body.storyType;
    }
    if (body.wordVolume && isWordVolume(body.wordVolume)) {
      wordVolume = body.wordVolume;
      wordTarget = WORD_VOLUME_TARGETS[wordVolume].words;
    }
    if (typeof body.wordTarget === "number" && body.wordTarget > 0) {
      wordTarget = Math.round(body.wordTarget);
    }
    if (body.answers && typeof body.answers === "object") {
      answers = Object.fromEntries(
        Object.entries(body.answers).map(([k, v]) => [k, String(v)]),
      );
    }
    if (Array.isArray(body.characterIds)) {
      characterIds = body.characterIds.map(String);
    }
    if (body.protagonistId) protagonistId = String(body.protagonistId);
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  if (!theme) {
    return NextResponse.json(
      { error: "Escolha um tema ou desejo para a história." },
      { status: 400 },
    );
  }

  const usage = await getStoryUsage();
  const mockUsed = await countMockStoriesThisMonth(user.id);
  const used = Math.max(
    usage.used,
    usage.source === "supabase" ? usage.used : mockUsed,
  );
  if (used >= usage.limit) {
    return NextResponse.json(
      {
        error: `Limite mensal atingido (${usage.limit ?? MONTHLY_STORY_LIMIT} histórias).`,
      },
      { status: 429 },
    );
  }

  const cast = await loadStoryCast(user.id);
  if (!cast) {
    return NextResponse.json(
      { error: "Cadastre a criança no onboarding antes de gerar." },
      { status: 400 },
    );
  }

  // Resolve nomes do elenco selecionado (opcional)
  let castNames: string[] | undefined;
  let protagonistName: string | undefined;
  const adminForChars = createAdminClient() ?? (await createClient());
  if (adminForChars && characterIds.length > 0) {
    const { data: chars } = await adminForChars
      .from("characters")
      .select("id, name, is_primary")
      .eq("parent_id", user.id)
      .in("id", characterIds);
    castNames = (chars ?? []).map((c) => c.name);
    const protag = (chars ?? []).find((c) => c.id === protagonistId);
    if (protag) protagonistName = protag.name;
    else if ((chars ?? []).some((c) => c.is_primary)) {
      protagonistName = (chars ?? []).find((c) => c.is_primary)?.name;
    }
  }
  if (!protagonistName) protagonistName = cast.childName;

  const { story: drafted, pipeline, engine } = await generateStoryPipeline({
    cast,
    theme,
    options: {
      userId: user.id,
      storyType,
      wordTarget,
      wordVolume,
      clarifyAnswers: answers,
      castNames,
      protagonistName,
    },
  });

  if (engine === "mock-v1") {
    return NextResponse.json(
      {
        error:
          "Não consegui gerar com a IA agora. Confira OPENAI_API_KEY e tente de novo.",
      },
      { status: 502 },
    );
  }

  const storyKey = crypto.randomUUID();
  let pages = drafted.pages;
  try {
    pages = await generateStoryPageImages({
      userId: user.id,
      storyKey,
      storyTitle: drafted.title,
      cast,
      pages: drafted.pages,
    });
  } catch {
    /* texto permanece mesmo se imagens falharem */
  }

  const withImages = pages.filter((p) => p.imageUrl).length;
  if (withImages === 0) {
    return NextResponse.json(
      {
        error:
          "A história foi escrita, mas as imagens Pixar falharam. Tente novamente.",
      },
      { status: 502 },
    );
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

  const questionsData = await generateStoryQuiz({
    userId: user.id,
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
          parent_id: user.id,
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
            storyType: storyType ?? null,
            wordTarget: wordTarget ?? null,
            wordVolume: wordVolume ?? null,
            pages: pages.length,
            quizCount: questionsData.length,
            pipeline: "outline-expand-split-pixar-quiz",
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
          parent_id: user.id,
          page_index: p.pageIndex,
          image_url: p.imageUrl || coverImageUrl || "",
          alt_text: p.altText,
          prompt_used: p.imagePrompt || `${engine}:page:${p.pageIndex}`,
        }));
        await db.from("story_images").insert(imageRows);
        await db
          .from("users")
          .update({ last_story_at: new Date().toISOString() })
          .eq("id", user.id);

        return NextResponse.json({
          success: true,
          storyId: story.id,
          shareToken: story.share_token,
          persistedTo: "supabase",
          engine,
          title: drafted.title,
          pages: pages.length,
          quizCount: questionsData.length,
          redirectTo: `/app/parent/stories/${story.id}`,
        });
      }
    } catch {
      /* mock fallback */
    }
  }

  const record: MockStoryRecord = {
    id: storyKey,
    parentId: user.id,
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
  const store = await cookies();
  store.set("em_mock_story_usage", String(used + 1), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  return NextResponse.json({
    success: true,
    storyId: record.id,
    shareToken: record.id,
    persistedTo: "mock",
    engine,
    title: drafted.title,
    pages: pages.length,
    quizCount: questionsData.length,
    redirectTo: `/app/parent/stories/${record.id}`,
  });
}
