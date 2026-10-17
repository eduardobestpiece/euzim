"use server";

import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth/get-user";
import {
  EXTRA_STORY_PRODUCT,
  FAMILY_SUBSCRIPTION,
  STARTER_SUBSCRIPTION,
  customAvatarPriceCents,
  packPriceCents,
  resolveCharacterPack,
  resolveStoryPlan,
  type StoryPlan,
} from "@/lib/billing/plans";
import { formatBrl, priceForAvatarCount } from "@/lib/billing/character-packs";
import {
  describeStripeKeyIssue,
  isStripeSecretValid,
  stripeMissingKeys,
} from "@/lib/stripe/config";
import { getStripe } from "@/lib/stripe/client";
import { ensureStripeCustomer } from "@/lib/stripe/customers";
import { mockFulfillCheckout } from "@/lib/stripe/fulfillment";

export type CheckoutActionResult = {
  error?: string;
  url?: string;
  mock?: boolean;
  missingKeys?: string[];
  keyIssue?: string | null;
  gated?: boolean;
};

async function appOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || "http";
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:5050";
}

function gateSecret(): CheckoutActionResult | null {
  if (isStripeSecretValid()) return null;
  const missing = stripeMissingKeys();
  const keyIssue = describeStripeKeyIssue();
  return {
    error:
      keyIssue ||
      "Checkout bloqueado: configure STRIPE_SECRET_KEY (sk_live_/rk_live_) para criar sessão. A publishable key já está no app.",
    missingKeys: missing,
    keyIssue,
    gated: true,
  };
}

async function createSubscriptionCheckout(
  plan: StoryPlan,
): Promise<CheckoutActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Faça login para assinar." };

  const gated = gateSecret();
  if (gated) return gated;

  const stripe = getStripe();
  if (!stripe) return { error: "Cliente Stripe indisponível." };

  const { customerId, error: customerError } = await ensureStripeCustomer({
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
  });
  if (!customerId) {
    return { error: customerError || "Não foi possível criar customer Stripe." };
  }

  const origin = await appOrigin();

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      metadata: {
        supabase_user_id: user.id,
        kind: "subscription",
        plan_id: plan.planId,
      },
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          plan_id: plan.planId,
        },
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "brl",
            unit_amount: plan.priceCents,
            recurring: { interval: "month" },
            product_data: {
              name: plan.name,
              description: plan.description,
            },
          },
        },
      ],
      success_url: `${origin}/app/parent/billing/success?session_id={CHECKOUT_SESSION_ID}&kind=subscription&plan_id=${plan.planId}`,
      cancel_url: `${origin}/app/parent/billing/cancel`,
      locale: "pt-BR",
    });

    if (!session.url) return { error: "Checkout sem URL de redirecionamento." };
    return { url: session.url };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha no Checkout.";
    return { error: message, missingKeys: stripeMissingKeys() };
  }
}

/** @deprecated use startPlanCheckoutAction('family') */
export async function startSubscriptionCheckoutAction(): Promise<CheckoutActionResult> {
  return createSubscriptionCheckout(FAMILY_SUBSCRIPTION);
}

export async function startPlanCheckoutAction(
  planId: string,
): Promise<CheckoutActionResult> {
  const plan = resolveStoryPlan(planId);
  if (!plan) return { error: "Plano inválido." };
  if (plan.kind === "extra_story") {
    return startExtraStoryCheckoutAction();
  }
  return createSubscriptionCheckout(plan);
}

export async function startExtraStoryCheckoutAction(): Promise<CheckoutActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Faça login." };

  const gated = gateSecret();
  if (gated) {
    return {
      ...gated,
      error: `${gated.error} Produto: ${EXTRA_STORY_PRODUCT.name} (${formatBrl(EXTRA_STORY_PRODUCT.priceBrl)}).`,
    };
  }

  const stripe = getStripe();
  if (!stripe) return { error: "Cliente Stripe indisponível." };

  const { customerId, error: customerError } = await ensureStripeCustomer({
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
  });
  if (!customerId) {
    return { error: customerError || "Não foi possível criar customer Stripe." };
  }

  const origin = await appOrigin();
  const plan = EXTRA_STORY_PRODUCT;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      client_reference_id: user.id,
      metadata: {
        supabase_user_id: user.id,
        kind: "extra_story",
        plan_id: plan.planId,
        stories: "1",
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "brl",
            unit_amount: plan.priceCents,
            product_data: {
              name: `Estúdio Mágico — ${plan.name}`,
              description: plan.description,
            },
          },
        },
      ],
      success_url: `${origin}/app/parent/billing/success?session_id={CHECKOUT_SESSION_ID}&kind=extra_story`,
      cancel_url: `${origin}/app/parent/billing/cancel`,
      locale: "pt-BR",
    });
    if (!session.url) return { error: "Checkout sem URL." };
    return { url: session.url };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Falha no Checkout.",
    };
  }
}

export async function startCharacterPackCheckoutAction(
  packId: string,
): Promise<CheckoutActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Faça login para comprar personagens." };

  const pack = resolveCharacterPack(packId);
  const cents = packPriceCents(packId);
  if (!pack || cents == null) return { error: "Pacote inválido." };

  const gated = gateSecret();
  if (gated) {
    return {
      ...gated,
      error: `${gated.error} Pacote ${pack.name} (${formatBrl(pack.priceBrl)}).`,
    };
  }

  const stripe = getStripe();
  if (!stripe) return { error: "Cliente Stripe indisponível." };

  const { customerId, error: customerError } = await ensureStripeCustomer({
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
  });
  if (!customerId) {
    return { error: customerError || "Não foi possível criar customer Stripe." };
  }

  const origin = await appOrigin();

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      client_reference_id: user.id,
      metadata: {
        supabase_user_id: user.id,
        kind: "character_pack",
        pack_id: pack.id,
        characters: String(pack.characters),
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "brl",
            unit_amount: cents,
            product_data: {
              name: `Estúdio Mágico — ${pack.name}`,
              description: pack.description,
            },
          },
        },
      ],
      success_url: `${origin}/app/parent/billing/success?session_id={CHECKOUT_SESSION_ID}&kind=character_pack&pack_id=${pack.id}`,
      cancel_url: `${origin}/app/parent/billing/cancel`,
      locale: "pt-BR",
    });

    if (!session.url) return { error: "Checkout sem URL de redirecionamento." };
    return { url: session.url };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha no Checkout.";
    return { error: message, missingKeys: stripeMissingKeys() };
  }
}

/** Compra custom 6–15 avatares a R$ 9,90 cada. */
export async function startCustomAvatarsCheckoutAction(
  count: number,
): Promise<CheckoutActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Faça login." };

  const brl = priceForAvatarCount(count);
  const cents = customAvatarPriceCents(count);
  if (brl == null || cents == null || count < 6) {
    return { error: "Quantidade inválida para preço unitário (use 6–15)." };
  }

  const gated = gateSecret();
  if (gated) {
    return {
      ...gated,
      error: `${gated.error} ${count} avatares · ${formatBrl(brl)}.`,
    };
  }

  const stripe = getStripe();
  if (!stripe) return { error: "Cliente Stripe indisponível." };

  const { customerId, error: customerError } = await ensureStripeCustomer({
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
  });
  if (!customerId) {
    return { error: customerError || "Customer Stripe falhou." };
  }

  const origin = await appOrigin();
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      client_reference_id: user.id,
      metadata: {
        supabase_user_id: user.id,
        kind: "custom_avatars",
        characters: String(count),
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "brl",
            unit_amount: cents,
            product_data: {
              name: `Estúdio Mágico — ${count} avatares`,
              description: `${count} × R$ 9,90`,
            },
          },
        },
      ],
      success_url: `${origin}/app/parent/billing/success?session_id={CHECKOUT_SESSION_ID}&kind=custom_avatars&count=${count}`,
      cancel_url: `${origin}/app/parent/billing/cancel`,
      locale: "pt-BR",
    });
    if (!session.url) return { error: "Checkout sem URL." };
    return { url: session.url };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Falha no Checkout.",
    };
  }
}

export async function mockActivateSubscriptionAction(
  planId: string = FAMILY_SUBSCRIPTION.planId,
): Promise<CheckoutActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Faça login." };
  const result = await mockFulfillCheckout({
    userId: user.id,
    kind: "subscription",
    planId,
  });
  if (!result.ok) return { error: result.error };
  return { mock: true };
}

export async function mockActivatePackAction(
  packId: string,
): Promise<CheckoutActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Faça login." };
  const result = await mockFulfillCheckout({
    userId: user.id,
    kind: "character_pack",
    packId,
  });
  if (!result.ok) return { error: result.error };
  return { mock: true };
}

export { STARTER_SUBSCRIPTION, FAMILY_SUBSCRIPTION, EXTRA_STORY_PRODUCT };
