import Link from "next/link";
import { AddFriendButton } from "@/components/social/add-friend-button";
import { StoryLikeButton } from "@/components/social/story-like-button";
import type { FeedPost } from "@/lib/social/types";

export function FeedCard({
  post,
  readHref,
}: {
  post: FeedPost;
  readHref: string;
}) {
  const showAddFriend =
    post.source === "public" && !post.isFriend && !post.isOwn;

  return (
    <article className="overflow-hidden rounded-2xl border border-border/70 bg-[radial-gradient(ellipse_at_top,_oklch(0.98_0.02_85),_transparent_70%)]">
      <div className="flex items-center gap-3 px-4 py-3">
        {post.authorAvatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.authorAvatarUrl}
            alt=""
            className="size-10 rounded-full object-cover"
          />
        ) : (
          <div className="size-10 rounded-full bg-muted" />
        )}
        <div className="min-w-0">
          <p className="truncate font-medium">{post.authorName}</p>
          <p className="text-xs text-muted-foreground">
            {post.source === "friends" ? "Amigo" : "Público"}
          </p>
        </div>
      </div>
      <Link href={readHref} className="block">
        {post.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.coverImageUrl}
            alt=""
            className="aspect-[4/3] w-full object-cover"
          />
        ) : (
          <div className="flex aspect-[4/3] w-full items-center justify-center bg-muted text-sm text-muted-foreground">
            Sem capa
          </div>
        )}
      </Link>
      <div className="space-y-2 px-4 py-3">
        <Link href={readHref} className="block">
          <h3 className="font-heading text-lg font-semibold leading-snug">
            {post.title}
          </h3>
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <StoryLikeButton
            storyId={post.storyId}
            initialLiked={post.likedByMe}
            initialCount={post.likeCount}
          />
          {showAddFriend ? <AddFriendButton userId={post.ownerId} /> : null}
        </div>
      </div>
    </article>
  );
}
