import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type PageFeedbackRating = "like" | "dislike";

export type PageFeedbackVote = {
  pageIndex: number;
  rating: PageFeedbackRating;
  comment: string | null;
};

export type FeedbackLessons = {
  imageRules: string;
  storyRules: string;
  sampleCount: number;
};

type FeedbackRow = {
  page_index: number;
  rating: string;
  comment: string | null;
};

function sanitizeComment(raw: string | null | undefined): string | null {
  const t = String(raw ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 1200);
  return t.length >= 3 ? t : null;
}

function uniqueBullets(items: string[], limit: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

/** Carrega o voto atual do usuário por página desta história. */
export async function loadPageFeedbackVotes(
  storyId: string,
  parentId: string,
): Promise<PageFeedbackVote[]> {
  const db = createAdminClient() ?? (await createClient());
  if (!db) return [];
  try {
    const { data, error } = await db
      .from("story_page_feedback")
      .select("page_index, rating, comment")
      .eq("story_id", storyId)
      .eq("parent_id", parentId);
    if (error || !data) return [];
    return (data as FeedbackRow[])
      .filter((r) => r.rating === "like" || r.rating === "dislike")
      .map((r) => ({
        pageIndex: r.page_index,
        rating: r.rating as PageFeedbackRating,
        comment: r.comment,
      }));
  } catch {
    return [];
  }
}

/**
 * Agrega comentários de "não gostei" recentes para ensinar a geração.
 * Prioriza o próprio usuário; completa com sinais globais da plataforma.
 */
export async function loadFeedbackLessons(
  userId?: string | null,
): Promise<FeedbackLessons> {
  const empty: FeedbackLessons = {
    imageRules: "",
    storyRules: "",
    sampleCount: 0,
  };
  const db = createAdminClient() ?? (await createClient());
  if (!db) return empty;

  const comments: string[] = [];
  try {
    if (userId) {
      const { data: mine } = await db
        .from("story_page_feedback")
        .select("comment")
        .eq("parent_id", userId)
        .eq("rating", "dislike")
        .not("comment", "is", null)
        .order("created_at", { ascending: false })
        .limit(24);
      for (const row of mine ?? []) {
        const c = sanitizeComment(
          (row as { comment?: string | null }).comment,
        );
        if (c) comments.push(c);
      }
    }

    if (comments.length < 16) {
      const { data: global } = await db
        .from("story_page_feedback")
        .select("comment")
        .eq("rating", "dislike")
        .not("comment", "is", null)
        .order("created_at", { ascending: false })
        .limit(40);
      for (const row of global ?? []) {
        const c = sanitizeComment(
          (row as { comment?: string | null }).comment,
        );
        if (c) comments.push(c);
      }
    }
  } catch {
    return empty;
  }

  const bullets = uniqueBullets(comments, 12);
  if (bullets.length === 0) return empty;

  const list = bullets.map((b) => `- ${b}`).join("\n");
  return {
    sampleCount: bullets.length,
    imageRules: [
      "LEARNED FROM PARENT FEEDBACK (avoid repeating these visual problems):",
      list,
      "Fix those issues in this still while keeping story beat, wardrobe locks, and character identity.",
    ].join("\n"),
    storyRules: [
      "Aprendizados de feedback dos pais (evite repetir estes problemas nas cenas e nos image prompts):",
      list,
    ].join("\n"),
  };
}

export function feedbackBoostFromComment(
  comment: string | null | undefined,
): string {
  const c = sanitizeComment(comment);
  if (!c) return "";
  return [
    "PARENT DISLIKE FIX (mandatory for this regeneration):",
    c,
    "Correct exactly that problem: change composition, props, pose, lighting, or NPC appearance as needed — keep protagonist identity and continuity locks.",
  ].join(" ");
}
