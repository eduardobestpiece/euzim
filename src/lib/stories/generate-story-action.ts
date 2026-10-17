"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { MONTHLY_STORY_LIMIT } from "@/lib/billing/character-packs";
import { getCurrentUser } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { generateStoryPipeline } from "@/lib/stories/generate-pipeline";
import type { StoryEngine } from "@/lib/stories/generate-pipeline";
import { generateStoryPageImages } from "@/lib/stories/generate-story-images";
import { loadStoryCast } from "@/lib/stories/story-cast";
import {
  countMockStoriesThisMonth,
  readMockStories,
  writeMockStories,
  type MockStoryRecord,
} from "@/lib/stories/mock-store";
import { getStoryUsage } from "@/lib/stories/usage";

export type GenerateStoryResult = {
  error?: string;
  success?: boolean;
  storyId?: string;
  shareToken?: string;
  persistedTo?: "supabase" | "mock";
  engine?: StoryEngine;
  title?: string;
  pages?: number;
};

/**
 * Mesmo pipeline da API (rascunho → revisão → atos → Pixar).
 * Mantido para compatibilidade; o form prefere /api/stories/generate.
 */
export async function generateStoryAction(
  _prev: GenerateStoryResult,
  formData: FormData,
): Promise<GenerateStoryResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Faça login para gerar uma história." };

  const theme = String(formData.get("theme") ?? "").trim();
  if (!theme) return { error: "Escolha um tema para a história." };

  const usage = await getStoryUsage();
  const mockUsed = await countMockStoriesThisMonth(user.id);
  const used = Math.max(
    usage.used,
    usage.source === "supabase" ? usage.used : mockUsed,
  );
  if (used >= usage.limit) {
    return {
      error: `Limite mensal atingido (${usage.limit ?? MONTHLY_STORY_LIMIT} histórias).`,
    };
  }

  const cast = await loadStoryCast(user.id);
  if (!cast) {
    return { error: "Cadastre a criança no onboarding antes de gerar." };
  }

  const { story: drafted, pipeline, engine } = await generateStoryPipeline({
    cast,
    theme,
  });

  if (engine === "mock-v1") {
    return {
      error:
        "Não consegui gerar com a IA agora. Confira OPENAI_API_KEY e tente de novo.",
    };
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
    /* texto permanece */
  }

  const withImages = pages.filter((p) => p.imageUrl).length;
  if (withImages === 0) {
    return {
      error:
        "A história foi escrita, mas as imagens Pixar falharam. Tente novamente em instantes.",
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
            stamp: "v17-storyteller-live",
          },
          published_at: new Date().toISOString(),
        })
        .select("id, share_token")
        .single();

      if (!storyError && story?.id) {
        await db.from("story_images").insert(
          pages.map((p) => ({
            story_id: story.id,
            parent_id: user.id,
            page_index: p.pageIndex,
            image_url: p.imageUrl || coverImageUrl || "",
            alt_text: p.altText,
            prompt_used: p.imagePrompt || `${engine}:page:${p.pageIndex}`,
          })),
        );
        await db
          .from("users")
          .update({ last_story_at: new Date().toISOString() })
          .eq("id", user.id);

        revalidatePath("/app/parent");
        revalidatePath(`/app/parent/stories/${story.id}`);
        return {
          success: true,
          storyId: story.id,
          shareToken: story.share_token ?? undefined,
          persistedTo: "supabase",
          engine,
          title: drafted.title,
          pages: pages.length,
        };
      }
    } catch {
      /* mock */
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

  return {
    success: true,
    storyId: record.id,
    shareToken: record.id,
    persistedTo: "mock",
    engine,
    title: drafted.title,
    pages: pages.length,
  };
}
