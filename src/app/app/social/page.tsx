import { Suspense } from "react";
import { connection } from "next/server";
import { AppPageFallback } from "@/components/app/app-page-fallback";
import { AppShell } from "@/components/app/app-shell";
import { SocialFeed } from "@/components/social/social-feed";
import { getCurrentUser } from "@/lib/auth/get-user";
import { loadSocialFeed } from "@/lib/social/feed";
import { listPendingFriendRequests } from "@/lib/social/friend-actions";

async function SocialPageInner({ kidsMode }: { kidsMode: boolean }) {
  await connection();
  const user = await getCurrentUser();
  if (!user) return null;

  const [posts, pendingRequests] = await Promise.all([
    loadSocialFeed(user.id),
    listPendingFriendRequests(user.id),
  ]);

  return (
    <AppShell user={user} title="Social" kidsMode={kidsMode}>
      <SocialFeed
        posts={posts}
        pendingRequests={pendingRequests}
        kidsMode={kidsMode}
        readBasePath="/app/social/read"
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
