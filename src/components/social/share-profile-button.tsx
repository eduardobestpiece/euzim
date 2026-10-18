"use client";

import { useState, useTransition } from "react";
import { Link2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createFriendInviteAction } from "@/lib/social/friend-actions";

export function ShareProfileButton() {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        className="gap-1.5"
        disabled={pending}
        onClick={() => {
          setError(null);
          setCopied(false);
          startTransition(async () => {
            const result = await createFriendInviteAction();
            if (result.error || !result.url) {
              setError(result.error ?? "Falha ao criar link.");
              return;
            }
            const absolute =
              typeof window !== "undefined"
                ? `${window.location.origin}${result.url}`
                : result.url;
            setUrl(absolute);
            try {
              await navigator.clipboard.writeText(absolute);
              setCopied(true);
            } catch {
              // ignore clipboard failures
            }
          });
        }}
      >
        <Share2 className="size-3.5" />
        {pending ? "Gerando…" : "Compartilhar perfil"}
      </Button>
      {url ? (
        <p className="flex items-start gap-1.5 break-all text-xs text-muted-foreground">
          <Link2 className="mt-0.5 size-3 shrink-0" />
          {copied ? "Link copiado: " : ""}
          {url}
        </p>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
