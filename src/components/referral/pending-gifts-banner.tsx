"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  claimGiftAction,
  listMyPendingGiftsAction,
} from "@/lib/referral/actions";
import type { GiftOptionId } from "@/lib/referral/constants";
import type { ReferralRewardRow } from "@/lib/referral/rewards";

export function PendingGiftsBanner({ compact = false }: { compact?: boolean }) {
  const [rewards, setRewards] = useState<ReferralRewardRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void listMyPendingGiftsAction().then((res) => {
      if (cancelled) return;
      setLoaded(true);
      if (res.error) {
        setError(res.error);
        return;
      }
      setRewards(res.rewards ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded || rewards.length === 0) return null;

  const reward = rewards[0]!;

  function claim(optionId: GiftOptionId) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await claimGiftAction(reward.id, optionId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage("Presente creditado na sua conta!");
      setRewards((prev) => prev.filter((r) => r.id !== reward.id));
    });
  }

  return (
    <section className="space-y-3 rounded-2xl border border-amber-500/40 bg-amber-50/80 p-4">
      <div className="flex items-start gap-2">
        <Gift className="mt-0.5 size-4 shrink-0 text-amber-800" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-amber-950">
            Alguém se cadastrou pelo seu link  -  escolha seu presente
          </p>
          {!compact ? (
            <p className="text-xs text-amber-900/80">
              Plano do indicado: {reward.plan_id}. Escolha uma opção.
            </p>
          ) : (
            <Link
              href="/app/parent/gifts"
              className="text-xs font-medium text-amber-950 underline"
            >
              Ver presentes
            </Link>
          )}
        </div>
      </div>

      {!compact ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {reward.options.map((opt) => (
            <Button
              key={opt.id}
              type="button"
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() => claim(opt.id)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      ) : null}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {message ? <p className="text-xs text-emerald-800">{message}</p> : null}
    </section>
  );
}
