"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PinGate } from "@/components/kids/pin-gate";
import { respondFriendshipAction } from "@/lib/social/friend-actions";
import type { PendingFriendship } from "@/lib/social/types";

export function PendingRequestsBanner({
  requests,
  kidsMode,
}: {
  requests: PendingFriendship[];
  kidsMode: boolean;
}) {
  const [items, setItems] = useState(requests);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [pinOpen, setPinOpen] = useState(false);
  const [queued, setQueued] = useState<{
    id: string;
    decision: "accepted" | "rejected";
  } | null>(null);

  if (items.length === 0) return null;

  function run(id: string, decision: "accepted" | "rejected") {
    setError(null);
    startTransition(async () => {
      const result = await respondFriendshipAction(id, decision);
      if (result.error) {
        setError(result.error);
        return;
      }
      setItems((prev) => prev.filter((r) => r.id !== id));
    });
  }

  function onDecide(id: string, decision: "accepted" | "rejected") {
    if (kidsMode) {
      setQueued({ id, decision });
      setPinOpen(true);
      return;
    }
    run(id, decision);
  }

  return (
    <section className="space-y-3 rounded-2xl border border-amber-200/80 bg-amber-50/60 p-4">
      <div>
        <h2 className="font-heading text-lg font-semibold">Pedidos de amizade</h2>
        <p className="text-sm text-muted-foreground">
          {kidsMode
            ? "Peça o PIN dos pais para aceitar ou recusar."
            : "Aceite ou recuse novos amigos."}
        </p>
      </div>
      <ul className="space-y-3">
        {items.map((req) => (
          <li
            key={req.id}
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <div className="flex min-w-0 items-center gap-3">
              {req.authorAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={req.authorAvatarUrl}
                  alt=""
                  className="size-10 rounded-full object-cover"
                />
              ) : (
                <div className="size-10 rounded-full bg-muted" />
              )}
              <p className="truncate font-medium">{req.authorName}</p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={pending}
                className="gap-1"
                onClick={() => onDecide(req.id, "accepted")}
              >
                <Check className="size-3.5" />
                Aceitar
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                className="gap-1"
                onClick={() => onDecide(req.id, "rejected")}
              >
                <X className="size-3.5" />
                Recusar
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <PinGate
        open={pinOpen}
        onOpenChange={setPinOpen}
        description="Digite o PIN dos pais para responder ao pedido de amizade."
        onVerified={async () => {
          if (!queued) return;
          run(queued.id, queued.decision);
          setQueued(null);
        }}
      />
    </section>
  );
}
