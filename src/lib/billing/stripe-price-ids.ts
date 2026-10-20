/**
 * Stripe Price/Product IDs (LIVE) — Euzim.
 * Gerado por scripts/upsert-stripe-tiered-plans.mjs — sem secrets.
 * Nunca coloque sk_/whsec_ neste arquivo.
 *
 * Em modo test (local :5050), use resolveStripePriceId() que lê o mapa
 * espelhado em stripe-price-ids.test.json.
 */

import { isStripeTestMode } from "@/lib/stripe/config";
import { readStripeTestPriceMap } from "@/lib/billing/stripe-price-map";

export const STRIPE_PRICE_IDS = {
  starter: "price_1URZD42RGWYUXReL1LuaJkHI",
  family: "price_1URZD42RGWYUXReLwWbPWFkf",
  plus: "price_1USgrd2RGWYUXReLZ2xl5DpA",
  extra_story: "price_1URZD42RGWYUXReLzlaa8myj",
  extra_story_starter: "price_1USgre2RGWYUXReLd28gsvrS",
  extra_story_family: "price_1USgrf2RGWYUXReLV0QuV6tA",
  extra_story_plus: "price_1USgrg2RGWYUXReLp1XSmLBw",
  "pack-1": "price_1URZD52RGWYUXReLJBO4mGh2",
  "pack-2": "price_1URZD52RGWYUXReL2BM6zjb0",
  "pack-3": "price_1URZD52RGWYUXReLRDVVeoOA",
  "pack-4": "price_1URZD62RGWYUXReLJy3Dl9LJ",
  "pack-5": "price_1URZD62RGWYUXReLxApF8ILx",
  /** Unidade R$ 9,90 — Checkout com quantity para 6+ */
  avatar_unit: "price_1URZD62RGWYUXReLiZ2MHkJ9",
} as const;

export const STRIPE_PRODUCT_IDS = {
  starter: "prod_VSUBri2FlAVcly",
  family: "prod_VSUBYLdM2LhWTn",
  plus: "prod_VTe94QxabUnvqm",
  extra_story: "prod_VSUByEpOj2mabF",
  extra_story_starter: "prod_VTe9hZdUmvFxmp",
  extra_story_family: "prod_VTe9G2VIhTvQan",
  extra_story_plus: "prod_VTeAFXUOEYFagg",
  "pack-1": "prod_VSUBNWkjUvC2u9",
  "pack-2": "prod_VSUBjZNwxKsFMs",
  "pack-3": "prod_VSUBtE4tfSzI8b",
  "pack-4": "prod_VSUBlwMeR8fPaM",
  "pack-5": "prod_VSUB5EMXIM0ijm",
  avatar_unit: "prod_VSUBrCXBKf2ite",
} as const;

export type StripePriceKey = keyof typeof STRIPE_PRICE_IDS;

/** IDs live (sempre). Prefira resolveStripePriceId no checkout. */
export function stripePriceId(key: StripePriceKey): string {
  return STRIPE_PRICE_IDS[key];
}

/** Price ID do modo atual (test map ou live). */
export function resolveStripePriceId(key: StripePriceKey): string {
  if (isStripeTestMode()) {
    const map = readStripeTestPriceMap();
    const testId = map.prices[key];
    if (testId) return testId;
  }
  return STRIPE_PRICE_IDS[key];
}
