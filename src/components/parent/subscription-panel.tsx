"use client";

import { useState, useTransition } from "react";
import { CreditCard, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  EXTRA_STORY_PRODUCT,
  FAMILY_SUBSCRIPTION,
  STARTER_SUBSCRIPTION,
} from "@/lib/billing/plans";
import { formatBrl } from "@/lib/billing/character-packs";
import {
  mockActivateSubscriptionAction,
  startBillingPortalAction,
  startExtraStoryCheckoutAction,
  startPlanCheckoutAction,
} from "@/lib/stripe/checkout-actions";
import { goToCheckout } from "@/lib/stripe/go-checkout";

export type BillingSnapshot = {
  subscriptionStatus?: string | null;
  planId?: string | null;
  stripeCustomerId?: string | null;
  extraCharacters?: number;
  stripeReady: boolean;
  missingKeys: string[];
  keyIssue: string | null;
};

export function SubscriptionPanel({ billing }: { billing: BillingSnapshot }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const active =
    billing.subscriptionStatus === "active" ||
    billing.subscriptionStatus === "trialing";

  function checkout(planId: string) {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const result = await startPlanCheckoutAction(planId);
      if (goToCheckout(result)) return;
      if (result.error) setError(result.error);
      if (result.missingKeys?.length) {
        setInfo(`Keys faltando: ${result.missingKeys.join(" · ")}`);
      }
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

  function simulate(planId: string) {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const result = await mockActivateSubscriptionAction(planId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setInfo("Assinatura ativada em modo simulado (Stripe secret ainda ausente).");
      window.location.reload();
    });
  }

  function openPortal() {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const result = await startBillingPortalAction();
      if (result.url) {
        window.location.href = result.url;
        return;
      }
      if (result.error) setError(result.error);
      if (result.missingKeys?.length) {
        setInfo(`Keys faltando: ${result.missingKeys.join(" · ")}`);
      }
    });
  }

  const plans = [STARTER_SUBSCRIPTION, FAMILY_SUBSCRIPTION];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 font-heading text-xl font-semibold">
          <CreditCard className="size-4" />
          Assinatura
        </h2>
        <p className="text-sm text-muted-foreground">
          Planos Euzim — pagamento via Stripe Checkout.
        </p>
      </div>

      {billing.keyIssue ? (
        <p className="rounded-md border border-amber-600/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-900">
          {billing.keyIssue}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {plans.map((plan) => {
          const current = active && billing.planId === plan.planId;
          return (
            <Card key={plan.id} className="shadow-none">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle>{plan.name}</CardTitle>
                  {current ? (
                    <Badge>ativa</Badge>
                  ) : (
                    <Badge variant="secondary">disponível</Badge>
                  )}
                </div>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="font-heading text-3xl font-semibold">
                  {formatBrl(plan.priceBrl)}
                  <span className="text-base font-normal text-muted-foreground">
                    /mês
                  </span>
                </p>
                <ul className="list-inside list-disc text-sm text-muted-foreground">
                  <li>{plan.storiesPerMonth} histórias por mês</li>
                  <li>
                    {plan.includedCharacters} personagem
                    {plan.includedCharacters > 1 ? "ns" : ""} incluso
                    {plan.includedCharacters > 1 ? "s" : ""}
                  </li>
                </ul>
              </CardContent>
              <CardFooter className="flex flex-wrap gap-2">
                <Button
                  onClick={() => checkout(plan.planId)}
                  disabled={pending || current}
                >
                  {current
                    ? "Plano atual"
                    : pending
                      ? "Abrindo…"
                      : "Assinar"}
                </Button>
                {!billing.stripeReady && !current ? (
                  <Button
                    variant="outline"
                    onClick={() => simulate(plan.planId)}
                    disabled={pending}
                  >
                    <ShieldCheck className="size-3.5" />
                    Simular
                  </Button>
                ) : null}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>{EXTRA_STORY_PRODUCT.name}</CardTitle>
          <CardDescription>{EXTRA_STORY_PRODUCT.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="font-heading text-2xl font-semibold">
            {formatBrl(EXTRA_STORY_PRODUCT.priceBrl)}
            <span className="text-sm font-normal text-muted-foreground">
              {" "}
              · pagamento único
            </span>
          </p>
        </CardContent>
        <CardFooter>
          <Button variant="secondary" onClick={buyExtra} disabled={pending}>
            Comprar história extra
          </Button>
        </CardFooter>
      </Card>

      {active ? (
        <Card className="shadow-none border-destructive/20">
          <CardHeader>
            <CardTitle className="text-base">Cancelar plano</CardTitle>
            <CardDescription>
              Abre o portal Stripe para cancelar ou gerenciar a cobrança. Você
              mantém o acesso até o fim do período já pago.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button
              type="button"
              variant="outline"
              className="border-destructive/40 text-destructive hover:bg-destructive/5"
              disabled={pending}
              onClick={openPortal}
            >
              {pending ? "Abrindo…" : "Cancelar plano"}
            </Button>
          </CardFooter>
        </Card>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Status: {billing.subscriptionStatus || "none"}
        {billing.planId ? ` · plano ${billing.planId}` : ""}
        {billing.extraCharacters
          ? ` · +${billing.extraCharacters} avatar(es) extra(s)`
          : ""}
      </p>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {info ? <p className="text-sm text-muted-foreground">{info}</p> : null}
    </div>
  );
}
