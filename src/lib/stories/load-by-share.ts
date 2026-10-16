import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { readMockStories } from "@/lib/stories/mock-store";
import type { StoryDetail } from "@/lib/stories/load-story";

function mapPages(
  textContent: unknown,
  images: { page_index: number; image_url: string; alt_text: string | null }[] | null,
  cover: string | null,
) {
  const textPages =
    (textContent as { pages?: { index: number; text: string }[] } | null)
      ?.pages ?? [];

  return [0, 1, 2, 3].map((pageIndex) => {
    const text =
      textPages.find((p) => p.index === pageIndex)?.text ??
      textPages[pageIndex]?.text ??
      "";
    const image = images?.find((i) => i.page_index === pageIndex);
    return {
      pageIndex,
      text,
      imageUrl: image?.image_url ?? cover ?? "",
      altText: image?.alt_text ?? `Página ${pageIndex + 1}`,
    };
  });
}

/** Carrega história pública por share_token UUID. */
export async function loadStoryByShareToken(
  shareToken: string,
): Promise<(StoryDetail & { shareToken: string }) | null> {
  const admin = createAdminClient();
  const userClient = await createClient();
  const db = admin ?? userClient;

  if (db) {
    try {
      const { data: story, error } = await db
        .from("stories")
        .select(
          "id, title, cover_image_url, text_content, share_token, is_public, status",
        )
        .eq("share_token", shareToken)
        .eq("is_public", true)
        .eq("status", "ready")
        .maybeSingle();

      if (!error && story) {
        const { data: images } = await db
          .from("story_images")
          .select("page_index, image_url, alt_text")
          .eq("story_id", story.id)
          .order("page_index", { ascending: true });

        return {
          id: story.id,
          title: story.title,
          coverImageUrl: story.cover_image_url,
          pages: mapPages(story.text_content, images, story.cover_image_url),
          source: "supabase",
          shareToken: story.share_token,
        };
      }
    } catch {
      // mock
    }
  }

  const mocks = await readMockStories();
  const mock = mocks.find((s) => s.id === shareToken);
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
