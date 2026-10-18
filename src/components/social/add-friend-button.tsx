"use client";

import { useState, useTransition } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestFriendshipAction } from "@/lib/social/friend-actions";

export function AddFriendButton({
  userId,
  disabledReason,
}: {
  userId: string;
  disabledReason?: string | null;
}) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (disabledReason) {
    return (
      <p className="text-xs text-muted-foreground">{disabledReason}</p>
    );
  }

  if (done) {
    return (
      <p className="text-xs font-medium text-emerald-800">Pedido enviado</p>
    );
  }

  return (
    <div className="space-y-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="gap-1.5"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await requestFriendshipAction(userId);
            if (result.error) {
              setError(result.error);
              return;
            }
            setDone(true);
          });
        }}
      >
        <UserPlus className="size-3.5" />
        Adicionar como amigo
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
