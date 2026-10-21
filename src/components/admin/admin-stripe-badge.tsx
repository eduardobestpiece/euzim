"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  syncStripeTestFromLiveAction,
  type StripeAdminStatus,
} from "@/lib/admin/stripe-sync-actions";

export function AdminStripeBadge({
  initial,
}: {
  initial: StripeAdminStatus;
}) {
  const [status, setStatus] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function sync() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await syncStripeTestFromLiveAction();
      if (res.error) {
        setError(res.error);
        return;
      }
      setMessage(res.message || "Sync ok.");
      setStatus((s) => ({
        ...s,
        mappedPrices: res.mapped ?? s.mappedPrices,
        generatedAt: new Date().toISOString(),
      }));
    });
  }

  const isTest = status.mode === "test";

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Badge
          variant={isTest ? "secondary" : "default"}
          className={
            isTest
              ? "bg-amber-100 text-amber-900 hover:bg-amber-100"
              : "bg-emerald-100 text-emerald-900 hover:bg-emerald-100"
          }
        >
          {status.label}
        </Badge>
        {isTest ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={sync}
            className="gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${pending ? "animate-spin" : ""}`} />
            Sincronizar Stripe Test
          </Button>
        ) : null}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Mapa test: {status.mappedPrices} prices
        {status.generatedAt
          ? ` · ${new Date(status.generatedAt).toLocaleString("pt-BR")}`
          : " · ainda não sincronizado"}
      </p>
      {message ? (
        <p className="max-w-xs text-right text-[11px] text-emerald-700">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="max-w-xs text-right text-[11px] text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
