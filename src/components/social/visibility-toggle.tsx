"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { updateStoryVisibilityAction } from "@/lib/social/visibility-actions";
import type { StoryVisibility } from "@/lib/social/types";

const OPTIONS: { value: StoryVisibility; label: string }[] = [
  { value: "private", label: "Privado" },
  { value: "friends", label: "Para Amigos" },
  { value: "public", label: "Público" },
];

export function VisibilityToggle({
  storyId,
  initial,
}: {
  storyId: string;
  initial: StoryVisibility;
}) {
  const [value, setValue] = useState<StoryVisibility>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            type="button"
            size="sm"
            variant={value === opt.value ? "default" : "outline"}
            disabled={pending}
            onClick={() => {
              if (opt.value === value) return;
              const prev = value;
              setValue(opt.value);
              setError(null);
              startTransition(async () => {
                const result = await updateStoryVisibilityAction(
                  storyId,
                  opt.value,
                );
                if (result.error) {
                  setValue(prev);
                  setError(result.error);
                }
              });
            }}
          >
            {opt.label}
          </Button>
        ))}
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
