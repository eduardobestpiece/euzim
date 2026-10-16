import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { readMockStories } from "@/lib/stories/mock-store";
import type { StoryDetail } from "@/lib/stories/load-story";

/** Carrega história pública por share_token (ou id mock). */
export async function loadStoryByShareToken(
  shareToken: string,
): Promise<StoryDetail | null> {
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
        .maybeSingle();

      if (
        !error &&
        story &&
        (story.is_public || story.status === "ready")
      ) {
        const { data: images } = await db
          .from("story_images")
          .select("page_index, image_url, alt_text")
          .eq("story_id", story.id)
          .order("page_index", { ascending: true });

        const textPages =
          (
            story.text_content as {
              pages?: { index: number; text: string }[];
            } | null
          )?.pages ?? [];

        const pages = [0, 1, 2, 3].map((pageIndex) => {
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
        };
      }
    } catch {
      // mock
    }
  }

  const mocks = await readMockStories();
  const mock =
    mocks.find((s) => s.id === shareToken) ??
    mocks.find((s) => s.id.startsWith(shareToken));
  if (!mock) return null;

  return {
    id: mock.id,
    title: mock.title,
    coverImageUrl: mock.coverImageUrl,
    pages: mock.pages,
    source: "mock",
  };
}
