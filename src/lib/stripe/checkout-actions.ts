"use server";

import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth/get-user";
import {
  FAMILY_SUBSCRIPTION,
  packPriceCents,
  resolveCharacterPack,
} from "@/lib/billing/plans";
import { formatBrl } from "@/lib/billing/character-packs";
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
};

async function appOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || "http";
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:5050";
}

export async function startSubscriptionCheckoutAction(): Promise<CheckoutActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Faça login para assinar." };

  const missing = stripeMissingKeys();
  const keyIssue = describeStripeKeyIssue();

  if (!isStripeSecretValid()) {
    return {
      error:
        keyIssue ||
        "Stripe ainda não autenticou. Configure sk_test_/sk_live_ para checkout real.",
      missingKeys: missing,
      keyIssue,
    };
  }

  const stripe = getStripe();
  if (!stripe) {
    return { error: "Cliente Stripe indisponível.", missingKeys: missing, keyIssue };
  }

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
        plan_id: FAMILY_SUBSCRIPTION.planId,
      },
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          plan_id: FAMILY_SUBSCRIPTION.planId,
        },
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "brl",
            unit_amount: FAMILY_SUBSCRIPTION.priceCents,
            recurring: { interval: "month" },
            product_data: {
              name: FAMILY_SUBSCRIPTION.name,
              description: FAMILY_SUBSCRIPTION.description,
            },
          },
        },
      ],
      success_url: `${origin}/app/parent/billing/success?session_id={CHECKOUT_SESSION_ID}&kind=subscription`,
      cancel_url: `${origin}/app/parent/billing/cancel`,
      locale: "pt-BR",
    });

    if (!session.url) return { error: "Checkout sem URL de redirecionamento." };
    return { url: session.url };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha no Checkout.";
    return { error: message, missingKeys: missing, keyIssue };
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

  const missing = stripeMissingKeys();
  const keyIssue = describeStripeKeyIssue();

  if (!isStripeSecretValid()) {
    return {
      error: `${keyIssue || "Stripe secret inválida."} Pacote ${pack.name} (${formatBrl(pack.priceBrl)}).`,
      missingKeys: missing,
      keyIssue,
    };
  }

  const stripe = getStripe();
  if (!stripe) {
    return { error: "Cliente Stripe indisponível.", missingKeys: missing };
  }

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
    return { error: message, missingKeys: missing, keyIssue };
  }
}

/** Ativa plano localmente enquanto Stripe secret/webhook não estão prontos. */
export async function mockActivateSubscriptionAction(): Promise<CheckoutActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Faça login." };
  const result = await mockFulfillCheckout({
    userId: user.id,
    kind: "subscription",
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
