import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { readMockStories } from "@/lib/stories/mock-store";

export type StoryDetail = {
  id: string;
  title: string;
  coverImageUrl: string | null;
  pages: { pageIndex: number; text: string; imageUrl: string; altText: string }[];
  source: "supabase" | "mock";
  shareToken?: string | null;
};

export async function loadStoryForParent(
  storyId: string,
  parentId: string,
): Promise<StoryDetail | null> {
  const admin = createAdminClient();
  const userClient = await createClient();
  const db = admin ?? userClient;

  if (db) {
    try {
      const { data: story, error } = await db
        .from("stories")
        .select(
          "id, title, cover_image_url, text_content, parent_id, share_token",
        )
        .eq("id", storyId)
        .maybeSingle();

      if (!error && story && story.parent_id === parentId) {
        const { data: images } = await db
          .from("story_images")
          .select("page_index, image_url, alt_text")
          .eq("story_id", storyId)
          .order("page_index", { ascending: true });

        const textPages =
          (
            story.text_content as {
              pages?: { index: number; text: string; title?: string }[];
            } | null
          )?.pages ?? [];

        const pageCount = Math.max(
          textPages.length,
          images?.length ?? 0,
          1,
        );

        const pages = Array.from({ length: pageCount }, (_, pageIndex) => {
          const text =
            textPages.find((p) => p.index === pageIndex)?.text ??
            textPages[pageIndex]?.text ??
            "";
          const image = images?.find((i) => i.page_index === pageIndex);
          return {
            pageIndex,
            text,
            imageUrl: image?.image_url ?? story.cover_image_url ?? "",
            altText: image?.alt_text ?? `Página ${pageIndex + 1}`,
          };
        });

        return {
          id: story.id,
          title: story.title,
          coverImageUrl: story.cover_image_url,
          pages,
          source: "supabase",
          shareToken: story.share_token,
        };
      }
    } catch {
      // fallback mock
    }
  }

  const mocks = await readMockStories();
  const mock = mocks.find((s) => s.id === storyId && s.parentId === parentId);
  if (!mock) return null;

  return {
    id: mock.id,
    title: mock.title,
    coverImageUrl: mock.coverImageUrl,
    pages: mock.pages,
    source: "mock",
    shareToken: mock.id,
  };
}

export async function listStoriesForParent(parentId: string): Promise<
  {
    id: string;
    title: string;
    coverImageUrl?: string | null;
    createdAt?: string;
  }[]
> {
  const admin = createAdminClient();
  const userClient = await createClient();
  const db = admin ?? userClient;

  if (db) {
    try {
      const { data, error } = await db
        .from("stories")
        .select("id, title, cover_image_url, created_at")
        .eq("parent_id", parentId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (!error && data) {
        return data.map((s) => ({
          id: s.id,
          title: s.title,
          coverImageUrl: s.cover_image_url,
          createdAt: s.created_at,
        }));
      }
    } catch {
      // mock
    }
  }

  const mocks = await readMockStories();
  return mocks
    .filter((s) => s.parentId === parentId)
    .map((s) => ({
      id: s.id,
      title: s.title,
      coverImageUrl: s.coverImageUrl,
      createdAt: s.createdAt,
    }));
}
