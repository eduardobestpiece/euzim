"use client";

import { useState, useTransition } from "react";
import { Gift, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMyReferralShareUrlAction } from "@/lib/referral/actions";

/** Compartilhar app (indicação) — distinto do convite de amizade. */
export function ShareAppButton() {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="secondary"
        className="gap-1.5"
        disabled={pending}
        onClick={() => {
          setError(null);
          setCopied(false);
          startTransition(async () => {
            const result = await getMyReferralShareUrlAction();
            if (result.error || !result.path) {
              setError(result.error ?? "Falha ao gerar link.");
              return;
            }
            const absolute =
              typeof window !== "undefined"
                ? `${window.location.origin}${result.path}`
                : result.path;
            setUrl(absolute);
            try {
              if (navigator.share) {
                await navigator.share({
                  title: "Euzim",
                  text: "Conheça o Euzim — histórias personalizadas para crianças.",
                  url: absolute,
                });
              } else {
                await navigator.clipboard.writeText(absolute);
                setCopied(true);
              }
            } catch {
              try {
                await navigator.clipboard.writeText(absolute);
                setCopied(true);
              } catch {
                // ignore
              }
            }
          });
        }}
      >
        <Gift className="size-3.5" />
        {pending ? "Gerando…" : "Compartilhar app"}
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
