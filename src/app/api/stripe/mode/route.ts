import { NextResponse } from "next/server";
import {
  getStripeMode,
  getStripePublishableKey,
  getStripeSecretKey,
  isStripeCheckoutReady,
  isStripeWebhookConfigured,
  stripeModeLabel,
  stripeMissingKeys,
} from "@/lib/stripe/config";
import { readStripeTestPriceMap } from "@/lib/billing/stripe-price-map";
import { PLATFORM_BUILD } from "@/lib/platform-build";

function keyPrefix(key: string): string {
  if (!key) return "";
  const parts = key.split("_");
  return parts.slice(0, 2).join("_") + "_…";
}

/** Smoke: modo Stripe atual (test vs live) sem expor secrets. */
export async function GET() {
  const mode = getStripeMode();
  const secret = getStripeSecretKey();
  const publishable = getStripePublishableKey();
  const map = readStripeTestPriceMap();

  return NextResponse.json({
    ok: true,
    build: PLATFORM_BUILD,
    mode,
    label: stripeModeLabel(),
    secretPrefix: keyPrefix(secret),
    publishablePrefix: keyPrefix(publishable),
    checkoutReady: isStripeCheckoutReady(),
    webhookConfigured: isStripeWebhookConfigured(),
    missingKeys: stripeMissingKeys(),
    testPriceMapCount: Object.keys(map.prices).length,
    testPriceMapGeneratedAt: map.generatedAt,
  });
}
