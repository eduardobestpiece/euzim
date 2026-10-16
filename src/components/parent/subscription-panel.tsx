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
import { FAMILY_SUBSCRIPTION } from "@/lib/billing/plans";
import { formatBrl } from "@/lib/billing/character-packs";
import {
  mockActivateSubscriptionAction,
  startSubscriptionCheckoutAction,
} from "@/lib/stripe/checkout-actions";

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

  function checkout() {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const result = await startSubscriptionCheckoutAction();
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

  function simulate() {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const result = await mockActivateSubscriptionAction();
      if (result.error) {
        setError(result.error);
        return;
      }
      setInfo("Assinatura ativada em modo simulado (Stripe secret ainda inválida).");
      window.location.reload();
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 font-heading text-xl font-semibold">
          <CreditCard className="size-4" />
          Assinatura
        </h2>
        <p className="text-sm text-muted-foreground">
          Plano Família do Estúdio Mágico — pagamento via Stripe Checkout.
        </p>
      </div>

      <Card className="shadow-none">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{FAMILY_SUBSCRIPTION.name}</CardTitle>
            {active ? <Badge>ativa</Badge> : <Badge variant="secondary">inativa</Badge>}
          </div>
          <CardDescription>{FAMILY_SUBSCRIPTION.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="font-heading text-3xl font-semibold">
            {formatBrl(FAMILY_SUBSCRIPTION.priceBrl)}
            <span className="text-base font-normal text-muted-foreground">
              /mês
            </span>
          </p>
          <ul className="list-inside list-disc text-sm text-muted-foreground">
            <li>{FAMILY_SUBSCRIPTION.storiesPerMonth} histórias por mês</li>
            <li>Avatar da criança + LoRA (pipeline)</li>
            <li>
              {FAMILY_SUBSCRIPTION.includedCharacters} personagem no 1º mês
              {billing.extraCharacters
                ? ` · +${billing.extraCharacters} extra(s)`
                : ""}
            </li>
          </ul>
          <p className="text-xs text-muted-foreground">
            Status: {billing.subscriptionStatus || "none"}
            {billing.planId ? ` · plano ${billing.planId}` : ""}
            {billing.stripeCustomerId
              ? ` · customer ${billing.stripeCustomerId.slice(0, 14)}…`
              : ""}
          </p>
          {!billing.stripeReady ? (
            <p className="rounded-md border border-amber-600/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-900">
              {billing.keyIssue ||
                "Checkout real aguarda chaves Stripe válidas (sk_/pk_/whsec_)."}
            </p>
          ) : null}
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          <Button onClick={checkout} disabled={pending || active}>
            {active ? "Já assinante" : pending ? "Abrindo…" : "Assinar agora"}
          </Button>
          {!billing.stripeReady && !active ? (
            <Button variant="outline" onClick={simulate} disabled={pending}>
              <ShieldCheck className="size-3.5" />
              Simular ativação
            </Button>
          ) : null}
        </CardFooter>
      </Card>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {info ? <p className="text-sm text-muted-foreground">{info}</p> : null}
    </div>
  );
}
