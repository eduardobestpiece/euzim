"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { MONTHLY_STORY_LIMIT } from "@/lib/billing/character-packs";
import { getCurrentUser } from "@/lib/auth/get-user";
import { readMockOnboarding } from "@/lib/auth/mock-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { generateStoryText } from "@/lib/stories/generate-openai";
import { ensureParentChildContext } from "@/lib/stories/ensure-profile";
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
  engine?: "openai-gpt-4o-mini" | "mock-v1";
  title?: string;
};

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
      error: `Limite mensal atingido (${usage.limit} histórias).`,
    };
  }

  let childCtx = await ensureParentChildContext(user);

  if (!childCtx) {
    const onboarding = await readMockOnboarding();
    if (!onboarding?.child?.displayName) {
      return {
        error: "Cadastre a primeira criança no onboarding antes de gerar.",
      };
    }
    childCtx = {
      childId: "mock-child",
      childName: onboarding.child.displayName,
    };
  }

  const { story: generated, engine } = await generateStoryText({
    childName: childCtx.childName,
    theme,
  });

  const admin = createAdminClient();
  const userClient = await createClient();
  const db = admin ?? userClient;

  if (db && childCtx.childId !== "mock-child") {
    try {
      let templateId: string | null = null;
      const slug = `theme-${theme
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 48)}`;

      const { data: existingTemplate } = await db
        .from("story_templates")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();

      if (existingTemplate?.id) {
        templateId = existingTemplate.id;
      } else {
        const { data: createdTemplate } = await db
          .from("story_templates")
          .insert({
            slug,
            title: theme,
            synopsis: `Template cacheado para o tema “${theme}”.`,
            theme_tags: [theme.toLowerCase()],
            is_public: true,
            is_active: true,
            created_by: user.id,
            prompt_skeleton: { theme, version: 1 },
          })
          .select("id")
          .maybeSingle();
        templateId = createdTemplate?.id ?? null;
      }

      const { data: story, error: storyError } = await db
        .from("stories")
        .insert({
          parent_id: user.id,
          child_id: childCtx.childId,
          character_id: childCtx.characterId ?? null,
          template_id: templateId,
          title: generated.title,
          status: "ready",
          is_public: true,
          text_content: generated.textContent,
          questions_data: [],
          cover_image_url: generated.coverImageUrl,
          generation_meta: {
            engine,
            theme,
            pages: 4,
          },
          published_at: new Date().toISOString(),
        })
        .select("id, share_token")
        .single();

      if (!storyError && story?.id) {
        const imageRows = generated.pages.map((p) => ({
          story_id: story.id,
          parent_id: user.id,
          page_index: p.pageIndex,
          image_url: p.imageUrl,
          alt_text: p.altText,
          prompt_used: `${engine}:${theme}:page:${p.pageIndex}`,
        }));

        const { error: imagesError } = await db
          .from("story_images")
          .insert(imageRows);

        if (!imagesError) {
          await db
            .from("users")
            .update({ last_story_at: new Date().toISOString() })
            .eq("id", user.id);

          revalidatePath("/app/parent");
          revalidatePath("/app/kids");
          revalidatePath(`/app/parent/stories/${story.id}`);
          revalidatePath(`/app/kids/read/${story.id}`);
          if (story.share_token) {
            revalidatePath(`/story/${story.share_token}`);
          }
          return {
            success: true,
            storyId: story.id,
            shareToken: story.share_token ?? undefined,
            persistedTo: "supabase",
            engine,
            title: generated.title,
          };
        }
      }
    } catch {
      // fallback mock
    }
  }

  const record: MockStoryRecord = {
    id: crypto.randomUUID(),
    parentId: user.id,
    childId: childCtx.childId,
    title: generated.title,
    status: "ready",
    textContent: generated.textContent,
    coverImageUrl: generated.coverImageUrl,
    pages: generated.pages,
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

  revalidatePath("/app/parent");
  revalidatePath(`/app/parent/stories/${record.id}`);

  return {
    success: true,
    storyId: record.id,
    shareToken: record.id,
    persistedTo: "mock",
    engine,
    title: generated.title,
  };
}
