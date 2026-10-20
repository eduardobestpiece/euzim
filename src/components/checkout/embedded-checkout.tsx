"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Button } from "@/components/ui/button";
import { trackBrowserEvent } from "@/lib/tracking/client-browser";
import { resolveStoryPlan } from "@/lib/billing/plans";

/** Local/dev → pk_test; produção → pk_live (NEXT_PUBLIC_* inlined no bundle). */
function resolveClientPublishableKey(): string {
  const isDev = process.env.NODE_ENV === "development";
  const testKey =
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST?.trim() || "";
  const mainKey =
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() || "";
  if (isDev) {
    if (testKey) return testKey;
    if (mainKey.startsWith("pk_test_")) return mainKey;
    return "";
  }
  return mainKey;
}

const publishableKey = resolveClientPublishableKey();

const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

export function EmbeddedCheckoutClient({
  userEmail,
  userId,
  fullName,
  phone,
}: {
  userEmail?: string | null;
  userId?: string | null;
  fullName?: string | null;
  phone?: string | null;
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const initiated = useRef(false);
  const paymentInfoSent = useRef(false);

  useEffect(() => {
    try {
      const cs = sessionStorage.getItem("euzim_checkout_cs");
      const plan = sessionStorage.getItem("euzim_checkout_plan");
      if (!cs) {
        setError("Sessão de checkout não encontrada. Volte e escolha o plano.");
        return;
      }
      setClientSecret(cs);
      setPlanId(plan);
    } catch {
      setError("Não foi possível ler a sessão de checkout.");
    }
  }, []);

  const plan = planId ? resolveStoryPlan(planId) : null;
  const user = useMemo(
    () => ({
      email: userEmail || undefined,
      userId: userId || undefined,
      fullName: fullName || undefined,
      phone: phone || undefined,
    }),
    [userEmail, userId, fullName, phone],
  );

  const commerce = useMemo(
    () =>
      plan
        ? {
            product: plan.name,
            planId: plan.planId,
            value: plan.priceBrl,
            currency: "BRL",
          }
        : undefined,
    [plan],
  );

  useEffect(() => {
    if (!clientSecret || initiated.current) return;
    initiated.current = true;
    void trackBrowserEvent({
      event: "InitiateCheckout",
      user,
      commerce,
      mirrorServer: true,
    });
  }, [clientSecret, user, commerce]);

  const markPaymentInfo = useCallback(() => {
    if (paymentInfoSent.current) return;
    paymentInfoSent.current = true;
    void trackBrowserEvent({
      event: "AddPaymentInfo",
      user,
      commerce,
      mirrorServer: true,
    });
  }, [user, commerce]);

  if (!publishableKey || !stripePromise) {
    return (
      <p className="text-sm text-destructive">
        Stripe publishable key ausente. No local configure
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST (pk_test_…).
      </p>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">{error}</p>
        <Button asChild variant="outline">
          <Link href="/app/parent/settings">Voltar ao perfil</Link>
        </Button>
      </div>
    );
  }

  if (!clientSecret) {
    return <p className="text-sm text-muted-foreground">Preparando checkout…</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Finalizar pagamento
        </h1>
        <p className="text-sm text-muted-foreground">
          {plan
            ? `${plan.name} · checkout seguro Stripe`
            : "Checkout seguro Stripe"}
        </p>
      </div>
      <div
        className="min-h-[480px] rounded-xl border border-border/60 bg-background p-2"
        onPointerDownCapture={markPaymentInfo}
        onFocusCapture={markPaymentInfo}
      >
        <EmbeddedCheckoutProvider
          stripe={stripePromise}
          options={{ clientSecret }}
        >
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      </div>
      <Button asChild variant="ghost" size="sm">
        <Link href="/app/parent/billing/cancel">Cancelar</Link>
      </Button>
    </div>
  );
}
