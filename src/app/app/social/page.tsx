import { Suspense } from "react";
import { connection } from "next/server";
import { AppPageFallback } from "@/components/app/app-page-fallback";
import { AppShell } from "@/components/app/app-shell";
import { SocialFeed } from "@/components/social/social-feed";
import { getCurrentUser } from "@/lib/auth/get-user";
import { FEED_PAGE_SIZE, loadSocialFeedPage } from "@/lib/social/feed";
import {
  countAcceptedFriends,
  listPendingFriendRequests,
} from "@/lib/social/friend-actions";

async function SocialPageInner({ kidsMode }: { kidsMode: boolean }) {
  await connection();
  const user = await getCurrentUser();
  if (!user) return null;

  const [page, pendingRequests, acceptedFriendCount] = await Promise.all([
    loadSocialFeedPage(user.id, 0, FEED_PAGE_SIZE),
    listPendingFriendRequests(user.id),
    countAcceptedFriends(user.id),
  ]);

  return (
    <AppShell user={user} title="Social" kidsMode={kidsMode}>
      <SocialFeed
        posts={page.posts}
        pendingRequests={pendingRequests}
        kidsMode={kidsMode}
        readBasePath="/app/social/read"
        acceptedFriendCount={acceptedFriendCount}
        initialHasMore={page.hasMore}
        initialNextOffset={page.nextOffset}
      />
    </AppShell>
  );
}

export default function SocialPage({
  searchParams,
}: {
  searchParams?: Promise<{ mode?: string }>;
}) {
  return (
    <Suspense fallback={<AppPageFallback label="Carregando Social…" />}>
      <SocialPageBridge searchParams={searchParams} />
    </Suspense>
  );
}

async function SocialPageBridge({
  searchParams,
}: {
  searchParams?: Promise<{ mode?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const kidsMode = sp.mode === "kids";
  return <SocialPageInner kidsMode={kidsMode} />;
}
