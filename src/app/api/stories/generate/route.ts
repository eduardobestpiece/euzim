import { NextResponse } from "next/server";
import { MONTHLY_STORY_LIMIT } from "@/lib/billing/character-packs";
import { getCurrentUser } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { generateStoryPipeline } from "@/lib/stories/generate-pipeline";
import { generateStoryPageImages } from "@/lib/stories/generate-story-images";
import { loadStoryCast } from "@/lib/stories/story-cast";
import {
  countMockStoriesThisMonth,
  readMockStories,
  writeMockStories,
  type MockStoryRecord,
} from "@/lib/stories/mock-store";
import { getStoryUsage } from "@/lib/stories/usage";
import { cookies } from "next/headers";

export const maxDuration = 300;

/** Pipeline completo: rascunho → revisão → atos → imagens Pixar. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Faça login." }, { status: 401 });
  }

  let theme = "";
  try {
    const body = (await request.json()) as { theme?: string };
    theme = String(body.theme ?? "").trim();
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

  const { story: drafted, pipeline, engine } = await generateStoryPipeline({
    cast,
    theme,
  });

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
          questions_data: [],
          cover_image_url: coverImageUrl,
          generation_meta: {
            engine,
            theme,
            pages: pages.length,
            pipeline: "draft-review-split-pixar",
            friend: { name: cast.friendName, kind: cast.friendKind },
            moral: pipeline.moral,
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
    redirectTo: `/app/parent/stories/${record.id}`,
  });
}
