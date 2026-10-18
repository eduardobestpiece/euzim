"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PinGate } from "@/components/kids/pin-gate";
import { respondFriendInviteAction } from "@/lib/social/friend-actions";

export function InviteAcceptClient({
  token,
  kidsMode = false,
}: {
  token: string;
  kidsMode?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [pinOpen, setPinOpen] = useState(false);
  const [queued, setQueued] = useState<"accepted" | "rejected" | null>(null);

  function run(decision: "accepted" | "rejected") {
    setError(null);
    startTransition(async () => {
      const result = await respondFriendInviteAction(token, decision);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push("/app/social");
      router.refresh();
    });
  }

  function onDecide(decision: "accepted" | "rejected") {
    if (kidsMode) {
      setQueued(decision);
      setPinOpen(true);
      return;
    }
    run(decision);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending} onClick={() => onDecide("accepted")}>
          Aceitar
        </Button>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => onDecide("rejected")}
        >
          Recusar
        </Button>
      </div>
      {kidsMode ? (
        <p className="text-xs text-muted-foreground">
          No modo Kids, o PIN dos pais é obrigatório para responder.
        </p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <PinGate
        open={pinOpen}
        onOpenChange={setPinOpen}
        description="Digite o PIN dos pais para responder ao convite."
        onVerified={async () => {
          if (!queued) return;
          run(queued);
          setQueued(null);
        }}
      />
    </div>
  );
}
