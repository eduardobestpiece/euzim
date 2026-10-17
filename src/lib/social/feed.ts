import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { loadPrimaryAuthors } from "@/lib/social/primary-author";
import type { FeedPost, StoryVisibility } from "@/lib/social/types";

function asVisibility(value: unknown, isPublic: boolean): StoryVisibility {
  if (value === "private" || value === "friends" || value === "public") {
    return value;
  }
  return isPublic ? "public" : "private";
}

/** Intercala 3 posts de amigos : 1 público geral. */
export function interleaveFeed(
  friendPosts: FeedPost[],
  publicPosts: FeedPost[],
): FeedPost[] {
  const out: FeedPost[] = [];
  let fi = 0;
  let pi = 0;
  while (fi < friendPosts.length || pi < publicPosts.length) {
    for (let n = 0; n < 3 && fi < friendPosts.length; n += 1) {
      out.push(friendPosts[fi]!);
      fi += 1;
    }
    if (pi < publicPosts.length) {
      out.push(publicPosts[pi]!);
      pi += 1;
    }
    if (fi >= friendPosts.length && pi < publicPosts.length) {
      while (pi < publicPosts.length) {
        out.push(publicPosts[pi]!);
        pi += 1;
      }
    }
  }
  return out;
}

export async function loadSocialFeed(viewerId: string): Promise<FeedPost[]> {
  const admin = createAdminClient();
  const userClient = await createClient();
  const db = admin ?? userClient;
  if (!db) return [];

  const { data: friendships } = await db
    .from("friendships")
    .select("requester_id, addressee_id, status")
    .eq("status", "accepted")
    .or(`requester_id.eq.${viewerId},addressee_id.eq.${viewerId}`);

  const friendIds = new Set<string>();
  for (const f of friendships ?? []) {
    const other =
      f.requester_id === viewerId ? f.addressee_id : f.requester_id;
    if (other) friendIds.add(other);
  }

  const friendIdList = [...friendIds];

  type StoryRow = {
    id: string;
    title: string;
    cover_image_url: string | null;
    visibility: string | null;
    is_public: boolean;
    parent_id: string;
    created_at: string;
  };

  let friendStories: StoryRow[] = [];
  if (friendIdList.length > 0) {
    const { data } = await db
      .from("stories")
      .select(
        "id, title, cover_image_url, visibility, is_public, parent_id, created_at",
      )
      .eq("status", "ready")
      .in("parent_id", friendIdList)
      .in("visibility", ["friends", "public"])
      .order("created_at", { ascending: false })
      .limit(60);
    friendStories = (data as StoryRow[] | null) ?? [];
  }

  const { data: publicData } = await db
    .from("stories")
    .select(
      "id, title, cover_image_url, visibility, is_public, parent_id, created_at",
    )
    .eq("status", "ready")
    .or("visibility.eq.public,is_public.eq.true")
    .neq("parent_id", viewerId)
    .order("created_at", { ascending: false })
    .limit(40);

  const publicStories = ((publicData as StoryRow[] | null) ?? []).filter(
    (s) => !friendIds.has(s.parent_id),
  );

  const allStories = [...friendStories, ...publicStories];
  const storyIds = allStories.map((s) => s.id);
  const ownerIds = allStories.map((s) => s.parent_id);
  const authors = await loadPrimaryAuthors(db, ownerIds);

  const likeCount = new Map<string, number>();
  const likedByMe = new Set<string>();
  if (storyIds.length > 0) {
    const { data: likes } = await db
      .from("story_likes")
      .select("story_id, user_id")
      .in("story_id", storyIds);
    for (const like of likes ?? []) {
      likeCount.set(like.story_id, (likeCount.get(like.story_id) ?? 0) + 1);
      if (like.user_id === viewerId) likedByMe.add(like.story_id);
    }
  }

  const toPost = (
    s: StoryRow,
    source: "friends" | "public",
  ): FeedPost => {
    const author = authors.get(s.parent_id) ?? {
      name: "Amigo",
      avatarUrl: null,
    };
    return {
      storyId: s.id,
      title: s.title,
      coverImageUrl: s.cover_image_url,
      visibility: asVisibility(s.visibility, s.is_public),
      ownerId: s.parent_id,
      authorName: author.name,
      authorAvatarUrl: author.avatarUrl,
      likeCount: likeCount.get(s.id) ?? 0,
      likedByMe: likedByMe.has(s.id),
      isFriend: friendIds.has(s.parent_id),
      isOwn: s.parent_id === viewerId,
      source,
      createdAt: s.created_at,
    };
  };

  const seen = new Set<string>();
  const friendPosts: FeedPost[] = [];
  for (const s of friendStories) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    friendPosts.push(toPost(s, "friends"));
  }

  const publicPosts: FeedPost[] = [];
  for (const s of publicStories) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    publicPosts.push(toPost(s, "public"));
  }

  return interleaveFeed(friendPosts, publicPosts);
}
