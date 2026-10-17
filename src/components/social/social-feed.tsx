import { FeedCard } from "@/components/social/feed-card";
import { EmailFriendSearch } from "@/components/social/email-friend-search";
import { PendingRequestsBanner } from "@/components/social/pending-requests-banner";
import { ShareAppButton } from "@/components/referral/share-app-button";
import { ShareProfileButton } from "@/components/social/share-profile-button";
import type { FeedPost, PendingFriendship } from "@/lib/social/types";

export function SocialFeed({
  posts,
  pendingRequests,
  kidsMode,
  readBasePath,
}: {
  posts: FeedPost[];
  pendingRequests: PendingFriendship[];
  kidsMode: boolean;
  readBasePath: "/app/social/read" | "/app/kids/read" | "/app/parent/stories";
}) {
  const modeSuffix = kidsMode ? "?mode=kids" : "";

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Social
        </h1>
        <p className="text-sm text-muted-foreground">
          Histórias dos amigos e descobertas públicas. Sem comentários — só
          curtidas e amizades.
        </p>
        {!kidsMode ? (
          <div className="flex flex-wrap gap-2">
            <ShareProfileButton />
            <ShareAppButton />
          </div>
        ) : null}
      </div>

      <PendingRequestsBanner requests={pendingRequests} kidsMode={kidsMode} />
      <EmailFriendSearch />

      {posts.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border/70 p-6 text-sm text-muted-foreground">
          O feed ainda está quieto. Adicione amigos ou publique uma história
          como Pública / Para Amigos na biblioteca.
        </p>
      ) : (
        <ul className="space-y-5">
          {posts.map((post) => (
            <li key={post.storyId}>
              <FeedCard
                post={post}
                readHref={`${readBasePath}/${post.storyId}${modeSuffix}`}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
