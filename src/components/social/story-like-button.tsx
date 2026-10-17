"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleStoryLikeAction } from "@/lib/social/like-actions";

export function StoryLikeButton({
  storyId,
  initialLiked,
  initialCount,
}: {
  storyId: string;
  initialLiked: boolean;
  initialCount: number;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="gap-1.5 px-2"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await toggleStoryLikeAction(storyId);
            if (result.error) {
              setError(result.error);
              return;
            }
            if (typeof result.liked === "boolean") setLiked(result.liked);
            if (typeof result.likeCount === "number") setCount(result.likeCount);
          });
        }}
      >
        <Heart
          className={
            liked
              ? "size-4 fill-rose-500 text-rose-500"
              : "size-4 text-muted-foreground"
          }
        />
        <span className="tabular-nums">{count}</span>
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
