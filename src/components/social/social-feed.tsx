"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Search, Share2, UserPlus } from "lucide-react";
import { FeedCard } from "@/components/social/feed-card";
import { EmailFriendSearch } from "@/components/social/email-friend-search";
import { PendingRequestsBanner } from "@/components/social/pending-requests-banner";
import { ShareAppButton } from "@/components/referral/share-app-button";
import { ShareProfileButton } from "@/components/social/share-profile-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loadMoreSocialFeedAction } from "@/lib/social/feed-actions";
import type { FeedPost, PendingFriendship } from "@/lib/social/types";

export function SocialFeed({
  posts: initialPosts,
  pendingRequests,
  kidsMode,
  readBasePath,
  acceptedFriendCount = 0,
  initialHasMore = false,
  initialNextOffset = 0,
}: {
  posts: FeedPost[];
  pendingRequests: PendingFriendship[];
  kidsMode: boolean;
  readBasePath: "/app/social/read" | "/app/kids/read" | "/app/parent/stories";
  acceptedFriendCount?: number;
  initialHasMore?: boolean;
  initialNextOffset?: number;
}) {
  const modeSuffix = kidsMode ? "?mode=kids" : "";
  const [posts, setPosts] = useState(initialPosts);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [nextOffset, setNextOffset] = useState(initialNextOffset);
  const [feedQuery, setFeedQuery] = useState("");
  const [addOpen, setAddOpen] = useState(acceptedFriendCount === 0 && !kidsMode);
  const [shareOpen, setShareOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setAddOpen(acceptedFriendCount === 0 && !kidsMode);
  }, [acceptedFriendCount, kidsMode]);

  const filtered = useMemo(() => {
    const q = feedQuery.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter(
      (p) =>
        p.authorName.toLowerCase().includes(q) ||
        p.title.toLowerCase().includes(q),
    );
  }, [posts, feedQuery]);

  function loadMore() {
    if (pending || !hasMore) return;
    startTransition(async () => {
      const result = await loadMoreSocialFeedAction(nextOffset);
      if (result.error || !result.posts) return;
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.storyId));
        const extra = result.posts!.filter((p) => !seen.has(p.storyId));
        return [...prev, ...extra];
      });
      setHasMore(Boolean(result.hasMore));
      setNextOffset(result.nextOffset ?? nextOffset);
    });
  }

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore();
      },
      { rootMargin: "240px" },
    );
    io.observe(node);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, nextOffset, pending]);

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <PendingRequestsBanner requests={pendingRequests} kidsMode={kidsMode} />

      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={feedQuery}
            onChange={(e) => setFeedQuery(e.target.value)}
            placeholder="Buscar amigos ou histórias"
            className="pl-9"
            aria-label="Buscar no feed por nome"
          />
        </div>
        {!kidsMode ? (
          <>
            <Button
              type="button"
              variant={addOpen ? "secondary" : "outline"}
              size="icon"
              className="shrink-0"
              aria-label="Adicionar amigo"
              aria-expanded={addOpen}
              onClick={() => {
                setAddOpen((v) => !v);
                setShareOpen(false);
              }}
            >
              <UserPlus className="size-4" />
            </Button>
            <div className="relative shrink-0">
              <Button
                type="button"
                variant={shareOpen ? "secondary" : "outline"}
                size="icon"
                aria-label="Compartilhar"
                aria-expanded={shareOpen}
                onClick={() => {
                  setShareOpen((v) => !v);
                  if (acceptedFriendCount > 0) setAddOpen(false);
                }}
              >
                <Share2 className="size-4" />
              </Button>
              {shareOpen ? (
                <div className="absolute right-0 z-20 mt-2 w-56 space-y-2 rounded-xl border border-border/70 bg-background p-3 shadow-lg">
                  <ShareProfileButton />
                  <ShareAppButton compact />
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </div>

      {addOpen && !kidsMode ? (
        <div className="rounded-2xl border border-border/70 p-4">
          <EmailFriendSearch compact title="Buscar amigo" />
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border/70 p-6 text-sm text-muted-foreground">
          {feedQuery.trim()
            ? "Nada encontrado com essa busca."
            : "O feed ainda está quieto. Adicione amigos ou publique uma história como Pública / Para Amigos na biblioteca."}
        </p>
      ) : (
        <ul className="space-y-5">
          {filtered.map((post) => (
            <li key={post.storyId}>
              <FeedCard
                post={post}
                readHref={`${readBasePath}/${post.storyId}${modeSuffix}`}
              />
            </li>
          ))}
        </ul>
      )}

      <div ref={sentinelRef} className="h-8" />
      {hasMore ? (
        <div className="flex justify-center pb-4">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={loadMore}
          >
            {pending ? "Carregando…" : "Carregar mais"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
