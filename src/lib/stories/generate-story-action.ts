"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { MONTHLY_STORY_LIMIT } from "@/lib/billing/character-packs";
import { getCurrentUser } from "@/lib/auth/get-user";
import { readMockOnboarding } from "@/lib/auth/mock-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { generateMockStory } from "@/lib/stories/generate-mock";
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
  persistedTo?: "supabase" | "mock";
  title?: string;
};

async function resolveChildContext(userId: string): Promise<{
  childId: string;
  childName: string;
  characterId?: string;
} | null> {
  if (!isSupabaseConfigured()) {
    const onboarding = await readMockOnboarding();
    if (!onboarding?.child?.displayName) return null;
    return {
      childId: "mock-child",
      childName: onboarding.child.displayName,
    };
  }

  const supabase = await createClient();
  const admin = createAdminClient();
  const client = admin ?? supabase;
  if (!client) {
    const onboarding = await readMockOnboarding();
    if (!onboarding?.child?.displayName) return null;
    return {
      childId: "mock-child",
      childName: onboarding.child.displayName,
    };
  }

  const { data: children, error } = await client
    .from("children")
    .select("id, display_name")
    .eq("parent_id", userId)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error || !children?.[0]) {
    const onboarding = await readMockOnboarding();
    if (onboarding?.child?.displayName) {
      return {
        childId: "mock-child",
        childName: onboarding.child.displayName,
      };
    }
    return null;
  }

  const { data: characters } = await client
    .from("characters")
    .select("id")
    .eq("parent_id", userId)
    .order("created_at", { ascending: true })
    .limit(1);

  return {
    childId: children[0].id,
    childName: children[0].display_name,
    characterId: characters?.[0]?.id,
  };
}

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
  const used = Math.max(usage.used, user.isMock ? mockUsed : usage.used);

  if (used >= MONTHLY_STORY_LIMIT) {
    return {
      error: `Limite mensal atingido (${MONTHLY_STORY_LIMIT} histórias).`,
    };
  }

  const childCtx = await resolveChildContext(user.id);
  if (!childCtx) {
    return {
      error: "Cadastre a primeira criança no onboarding antes de gerar.",
    };
  }

  const generated = generateMockStory({
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
            is_public: false,
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
          is_public: false,
          text_content: generated.textContent,
          questions_data: [],
          cover_image_url: generated.coverImageUrl,
          generation_meta: {
            engine: "mock-v1",
            theme,
            pages: 4,
          },
          published_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (!storyError && story?.id) {
        const imageRows = generated.pages.map((p) => ({
          story_id: story.id,
          parent_id: user.id,
          page_index: p.pageIndex,
          image_url: p.imageUrl,
          alt_text: p.altText,
          prompt_used: `mock:${theme}:page:${p.pageIndex}`,
        }));

        const { error: imagesError } = await db
          .from("story_images")
          .insert(imageRows);

        if (!imagesError) {
          revalidatePath("/app/parent");
          revalidatePath(`/app/parent/stories/${story.id}`);
          return {
            success: true,
            storyId: story.id,
            persistedTo: "supabase",
            title: generated.title,
          };
        }
      }
    } catch {
      // cai no mock abaixo
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
    persistedTo: "mock",
    title: generated.title,
  };
}
