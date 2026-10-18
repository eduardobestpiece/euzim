import { NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  getStripeWebhookSecret,
  isStripeSecretValid,
  isStripeWebhookConfigured,
  describeStripeKeyIssue,
} from "@/lib/stripe/config";
import { getStripe } from "@/lib/stripe/client";
import {
  fulfillCharacterPack,
  fulfillExtraStory,
  fulfillSubscription,
} from "@/lib/stripe/fulfillment";
import { grantReferralRewardOnFirstSubscription } from "@/lib/referral/rewards";

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId =
    session.metadata?.supabase_user_id || session.client_reference_id || null;
  if (!userId) return { skipped: true, reason: "missing user id" };

  const kind = session.metadata?.kind;
  if (kind === "subscription" || session.mode === "subscription") {
    const planId = session.metadata?.plan_id || "family";
    const result = await fulfillSubscription(userId, planId);
    // Só 1ª assinatura (idempotente via referral_rewarded_at / unique referee)
    const referral = result.ok
      ? await grantReferralRewardOnFirstSubscription({
          refereeId: userId,
          planId,
        })
      : { ok: false, skipped: true };
    return { ...result, referral };
  }
  if (kind === "extra_story") {
    return fulfillExtraStory(userId);
  }
  if (kind === "custom_avatars") {
    const count = Number.parseInt(session.metadata?.characters || "0", 10);
    if (!count) return { ok: false, error: "characters ausente" };
    return fulfillCharacterPack(userId, "custom", count);
  }
  if (kind === "character_pack") {
    const packId = session.metadata?.pack_id;
    if (!packId) return { ok: false, error: "pack_id ausente" };
    return fulfillCharacterPack(userId, packId);
  }
  return { skipped: true, reason: "unknown kind" };
}

export async function POST(request: Request) {
  if (!isStripeSecretValid()) {
    return NextResponse.json(
      {
        error: "Stripe secret inválida",
        detail: describeStripeKeyIssue(),
        ready: false,
      },
      { status: 503 },
    );
  }

  if (!isStripeWebhookConfigured()) {
    return NextResponse.json(
      {
        error: "STRIPE_WEBHOOK_SECRET ausente ou inválido (whsec_…)",
        ready: false,
        hint: "Configure o endpoint /api/stripe/webhook no Dashboard Stripe e cole o signing secret.",
      },
      { status: 503 },
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe client null" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      getStripeWebhookSecret(),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const result = await handleCheckoutCompleted(session);
        return NextResponse.json({ received: true, result });
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        // Status sync leve — expandível
        return NextResponse.json({ received: true, noted: event.type });
      }
      default:
        return NextResponse.json({ received: true, ignored: event.type });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "handler error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/stripe/webhook",
    secretConfigured: isStripeWebhookConfigured(),
    stripeSecretValid: isStripeSecretValid(),
    keyIssue: describeStripeKeyIssue(),
  });
}
