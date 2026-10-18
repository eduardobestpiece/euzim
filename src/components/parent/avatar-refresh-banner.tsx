"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AvatarRefreshStatus } from "@/lib/onboarding/avatar-refresh";

function subscribe() {
  return () => {};
}

export function AvatarRefreshBanner({ status }: { status: AvatarRefreshStatus }) {
  // Relógio só no getSnapshot do cliente — nunca no prerender RSC
  const due = useSyncExternalStore(
    subscribe,
    () => {
      if (!status.dueAt) return false;
      const t = Date.parse(status.dueAt);
      return Number.isFinite(t) && t <= Date.now();
    },
    () => false,
  );

  if (!due) return null;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-amber-600/30 bg-amber-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <p className="flex items-center gap-2 text-sm font-semibold text-amber-950">
          <Camera className="size-4" />
          Hora de renovar as fotos
          {status.childName ? ` de ${status.childName}` : ""}
        </p>
        <p className="text-xs text-amber-900/80">
          Faz cerca de 12 meses desde a última captura. Novas fotos mantêm o
          avatar parecido com a criança.
        </p>
      </div>
      <Button asChild size="sm" variant="outline" className="shrink-0">
        <Link href="/onboarding">Atualizar fotos</Link>
      </Button>
    </div>
  );
}
