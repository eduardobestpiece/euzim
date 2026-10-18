import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  buildQuizFromPages,
  normalizeQuizQuestions,
} from "@/lib/stories/quiz";
import type { StoryDetail } from "@/lib/stories/load-story";
import type { StoryVisibility } from "@/lib/social/types";

function asVisibility(value: unknown, isPublic: boolean): StoryVisibility {
  if (value === "private" || value === "friends" || value === "public") {
    return value;
  }
  return isPublic ? "public" : "private";
}

async function areFriends(
  db: NonNullable<ReturnType<typeof createAdminClient> | Awaited<ReturnType<typeof createClient>>>,
  a: string,
  b: string,
): Promise<boolean> {
  const { data } = await db
    .from("friendships")
    .select("id")
    .eq("status", "accepted")
    .or(
      `and(requester_id.eq.${a},addressee_id.eq.${b}),and(requester_id.eq.${b},addressee_id.eq.${a})`,
    )
    .maybeSingle();
  return Boolean(data);
}

/** Carrega história pronta se o viewer for dono, amigo (friends/public) ou se for pública. */
export async function loadStoryForViewer(
  storyId: string,
  viewerId: string,
): Promise<StoryDetail | null> {
  const admin = createAdminClient();
  const userClient = await createClient();
  const db = admin ?? userClient;
  if (!db) return null;

  const { data: story, error } = await db
    .from("stories")
    .select(
      "id, title, cover_image_url, text_content, questions_data, parent_id, share_token, visibility, is_public, status",
    )
    .eq("id", storyId)
    .eq("status", "ready")
    .maybeSingle();

  if (error || !story) return null;

  const visibility = asVisibility(story.visibility, story.is_public);
  const isOwner = story.parent_id === viewerId;
  let allowed = isOwner || visibility === "public" || story.is_public;

  if (!allowed && visibility === "friends") {
    allowed = await areFriends(db, viewerId, story.parent_id);
  }

  if (!allowed) return null;

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

  const pageCount = Math.max(textPages.length, images?.length ?? 0, 1);
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

  const saved = normalizeQuizQuestions(story.questions_data);
  const questions =
    saved.length > 0 ? saved : buildQuizFromPages(story.title, pages);

  return {
    id: story.id,
    title: story.title,
    coverImageUrl: story.cover_image_url,
    pages,
    source: "supabase",
    shareToken: story.share_token,
    questions,
  };
}
