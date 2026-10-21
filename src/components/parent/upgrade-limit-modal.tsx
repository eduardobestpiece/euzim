"use client";

import { useEffect, useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatBrl } from "@/lib/billing/character-packs";
import { extraStoryForPlan } from "@/lib/billing/plans";
import { goToCheckout } from "@/lib/stripe/go-checkout";
import { startExtraStoryCheckoutAction } from "@/lib/stripe/checkout-actions";
import {
  getUpgradePreviewAction,
  upgradeSubscriptionAction,
  type UpgradePreview,
} from "@/lib/stripe/upgrade-actions";

export function UpgradeLimitModal({
  open,
  onOpenChange,
  currentPlanId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlanId?: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<UpgradePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const planId = currentPlanId || preview?.currentPlanId || null;
  const extra = extraStoryForPlan(planId);
  const isPlus = planId === "plus";

  useEffect(() => {
    if (!open) return;
    setError(null);
    setInfo(null);
    void getUpgradePreviewAction().then((res) => {
      if (res.error) setError(res.error);
      if (res.preview) setPreview(res.preview);
    });
  }, [open]);

  function upgrade(targetPlanId: string) {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const result = await upgradeSubscriptionAction(targetPlanId);
      if (result.upgraded) {
        setInfo("Plano atualizado! Recarregando…");
        window.location.reload();
        return;
      }
      if (goToCheckout(result)) return;
      if (result.error) setError(result.error);
    });
  }

  function buyExtra() {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const result = await startExtraStoryCheckoutAction();
      if (goToCheckout(result)) return;
      if (result.error) setError(result.error);
    });
  }

  const upgrades = preview?.upgrades ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4" />
            Continue construindo histórias
          </DialogTitle>
          <DialogDescription>
            {isPlus
              ? "Você já está no Plus. Compre uma história avulsa para seguir criando este mês."
              : "Faça upgrade (diferença prorata) ou compre uma história avulsa."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {!isPlus && upgrades.length > 0
            ? upgrades.map((u) => (
                <div
                  key={u.planId}
                  className="flex items-start justify-between gap-3 rounded-xl border border-border/70 px-3 py-3"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-medium">{u.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {u.storiesPerMonth} histórias/mês ·{" "}
                      {formatBrl(u.priceBrl)}/mês
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Diferença: {formatBrl(u.deltaBrl)}
                      {preview?.canProrate ? " (prorrata Stripe)" : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() => upgrade(u.planId)}
                  >
                    Upgrade
                  </Button>
                </div>
              ))
            : null}

          <div className="flex items-start justify-between gap-3 rounded-xl border border-border/70 px-3 py-3">
            <div className="min-w-0 space-y-0.5">
              <p className="font-medium">História adicional</p>
              <p className="text-xs text-muted-foreground">
                Avulsa · {formatBrl(extra.priceBrl)}
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={buyExtra}
            >
              Comprar
            </Button>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {info ? <p className="text-sm text-emerald-700">{info}</p> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
