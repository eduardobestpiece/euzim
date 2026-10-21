"use client";

import { useState } from "react";
import { BookOpen } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UpgradeLimitModal } from "@/components/parent/upgrade-limit-modal";
import type { StoryUsage } from "@/lib/stories/usage";

function fmtRenewal(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toLocaleDateString("pt-BR", { dateStyle: "long" });
}

export function StoryUsageTracker({ usage }: { usage: StoryUsage }) {
  const [modalOpen, setModalOpen] = useState(false);
  const pct =
    usage.limit > 0
      ? Math.min(100, Math.round((usage.used / usage.limit) * 100))
      : 0;
  const remaining = Math.max(0, usage.limit - usage.used);
  const atLimit = usage.used >= usage.limit;
  const renewLabel = fmtRenewal(usage.renewsAt);

  return (
    <section className="space-y-4 rounded-xl border border-border/70 bg-background p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <BookOpen className="size-4" />
            Histórias do mês
          </p>
          <p className="font-heading text-2xl font-semibold tracking-tight">
            Histórias usadas: {usage.used}/{usage.limit}
          </p>
          <p className="text-sm text-muted-foreground">
            {remaining === 0
              ? "Limite mensal atingido."
              : `Restam ${remaining} história${remaining === 1 ? "" : "s"} neste ciclo.`}
          </p>
          {renewLabel ? (
            <p className="text-sm text-muted-foreground">
              Renovação: {renewLabel}
            </p>
          ) : null}
        </div>
        <Badge variant="secondary">
          {usage.source === "supabase" ? "ao vivo" : "local"}
        </Badge>
      </div>
      <Progress value={pct} className="h-2" />
      {atLimit ? (
        <Button type="button" onClick={() => setModalOpen(true)}>
          Continue construindo histórias
        </Button>
      ) : null}
      <UpgradeLimitModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        currentPlanId={usage.planId}
      />
    </section>
  );
}
