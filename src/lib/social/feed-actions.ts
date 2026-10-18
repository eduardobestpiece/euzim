"use server";

import { getCurrentUser } from "@/lib/auth/get-user";
import { FEED_PAGE_SIZE, loadSocialFeedPage } from "@/lib/social/feed";
import type { FeedPost } from "@/lib/social/types";

export async function loadMoreSocialFeedAction(
  offset: number,
  limit = FEED_PAGE_SIZE,
): Promise<{
  error?: string;
  posts?: FeedPost[];
  hasMore?: boolean;
  nextOffset?: number;
}> {
  const user = await getCurrentUser();
  if (!user) return { error: "Não autenticado." };
  const page = await loadSocialFeedPage(user.id, Math.max(0, offset), limit);
  return {
    posts: page.posts,
    hasMore: page.hasMore,
    nextOffset: page.nextOffset,
  };
}
