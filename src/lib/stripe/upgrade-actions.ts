"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/get-user";
import {
  normalizePlanSource,
  planSourceFromStripeMode,
  type PlanSource,
} from "@/lib/billing/plan-source";
import { planRank, plansAbove } from "@/lib/billing/plan-rank";
import { resolveSubscriptionPlan } from "@/lib/billing/plans";
import { resolveStripePriceId } from "@/lib/billing/stripe-price-ids";
import {
  describeStripeKeyIssue,
  getStripeMode,
  isStripeCheckoutReady,
  stripeMissingKeys,
} from "@/lib/stripe/config";
import { getStripe } from "@/lib/stripe/client";
import { fulfillSubscription } from "@/lib/stripe/fulfillment";
import { subscriptionPeriodEndIso } from "@/lib/stripe/subscription-period";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { CheckoutActionResult } from "@/lib/stripe/checkout-actions";
import { startPlanCheckoutAction } from "@/lib/stripe/checkout-actions";

export type UpgradePreview = {
  currentPlanId: string | null;
  planSource: PlanSource;
  upgrades: Array<{
    planId: string;
    name: string;
    priceBrl: number;
    deltaBrl: number;
    storiesPerMonth: number;
  }>;
  canProrate: boolean;
};

export async function getUpgradePreviewAction(): Promise<{
  error?: string;
  preview?: UpgradePreview;
}> {
  const user = await getCurrentUser();
  if (!user) return { error: "Faça login." };

  const db = createAdminClient() ?? (await createClient());
  if (!db) return { error: "Banco indisponível." };

  const { data: profile } = await db
    .from("users")
    .select(
      "subscription_plan_id, plan_source, stripe_customer_id, stripe_subscription_id, subscription_status",
    )
    .eq("id", user.id)
    .maybeSingle();

  const currentPlanId = profile?.subscription_plan_id ?? null;
  const current = resolveSubscriptionPlan(currentPlanId || "");
  const currentPrice = current?.priceBrl ?? 0;
  const planSource = normalizePlanSource(profile?.plan_source);
  const active =
    profile?.subscription_status === "active" ||
    profile?.subscription_status === "trialing";

  const upgrades = plansAbove(currentPlanId).map((p) => ({
    planId: p.planId,
    name: p.name,
    priceBrl: p.priceBrl,
    deltaBrl: Math.max(0, Number((p.priceBrl - currentPrice).toFixed(2))),
    storiesPerMonth: p.storiesPerMonth,
  }));

  const canProrate =
    active &&
    planSource !== "gift" &&
    Boolean(profile?.stripe_customer_id || profile?.stripe_subscription_id);

  return {
    preview: {
      currentPlanId,
      planSource,
      upgrades,
      canProrate,
    },
  };
}

/**
 * Upgrade proratado via Stripe `subscriptions.update`.
 * Presente: só muda cota local (sem Stripe).
 * Sem assinatura Stripe: fallback para Checkout embutido.
 */
export async function upgradeSubscriptionAction(
  targetPlanId: string,
): Promise<CheckoutActionResult & { upgraded?: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Faça login." };

  const target = resolveSubscriptionPlan(targetPlanId);
  if (!target) return { error: "Plano de destino inválido." };

  const db = createAdminClient() ?? (await createClient());
  if (!db) return { error: "Banco indisponível." };

  const { data: profile } = await db
    .from("users")
    .select(
      "subscription_plan_id, plan_source, stripe_customer_id, stripe_subscription_id, subscription_status",
    )
    .eq("id", user.id)
    .maybeSingle();

  const currentId = profile?.subscription_plan_id ?? null;
  if (planRank(target.planId) <= planRank(currentId)) {
    return { error: "Escolha um plano acima do atual." };
  }

  const planSource = normalizePlanSource(profile?.plan_source);

  // Presente: só cota local
  if (planSource === "gift") {
    const result = await fulfillSubscription(user.id, target.planId, {
      planSource: "gift",
    });
    if (!result.ok) return { error: result.error };
    revalidatePath("/app/parent");
    return { upgraded: true, planId: target.planId, kind: "subscription" };
  }

  if (!isStripeCheckoutReady()) {
    return {
      error:
        describeStripeKeyIssue() ||
        "Checkout bloqueado: configure as chaves Stripe.",
      missingKeys: stripeMissingKeys(),
      gated: true,
    };
  }

  const stripe = getStripe();
  if (!stripe) return { error: "Cliente Stripe indisponível." };

  let subscriptionId = profile?.stripe_subscription_id || null;
  const customerId = profile?.stripe_customer_id || null;

  if (!subscriptionId && customerId) {
    try {
      const list = await stripe.subscriptions.list({
        customer: customerId,
        status: "active",
        limit: 1,
      });
      subscriptionId = list.data[0]?.id ?? null;
      if (!subscriptionId) {
        const trialing = await stripe.subscriptions.list({
          customer: customerId,
          status: "trialing",
          limit: 1,
        });
        subscriptionId = trialing.data[0]?.id ?? null;
      }
    } catch (err) {
      return {
        error:
          err instanceof Error
            ? err.message
            : "Falha ao buscar assinatura Stripe.",
      };
    }
  }

  if (!subscriptionId) {
    // Sem sub ativa → Checkout novo
    return startPlanCheckoutAction(target.planId);
  }

  const priceId = resolveStripePriceId(
    target.planId as "starter" | "family" | "plus",
  );

  try {
    const existing = await stripe.subscriptions.retrieve(subscriptionId);
    const itemId = existing.items.data[0]?.id;
    if (!itemId) return { error: "Assinatura Stripe sem item." };

    const updated = await stripe.subscriptions.update(subscriptionId, {
      items: [{ id: itemId, price: priceId }],
      proration_behavior: "create_prorations",
      metadata: {
        ...(existing.metadata || {}),
        supabase_user_id: user.id,
        plan_id: target.planId,
      },
    });

    const periodEnd = subscriptionPeriodEndIso(updated);
    const source = planSourceFromStripeMode(getStripeMode());
    const fulfill = await fulfillSubscription(user.id, target.planId, {
      planSource: source,
      stripeSubscriptionId: updated.id,
      stripeCurrentPeriodEnd: periodEnd,
    });
    if (!fulfill.ok) return { error: fulfill.error };

    revalidatePath("/app/parent");
    return {
      upgraded: true,
      planId: target.planId,
      kind: "subscription",
    };
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Falha no upgrade proratado Stripe.",
    };
  }
}
