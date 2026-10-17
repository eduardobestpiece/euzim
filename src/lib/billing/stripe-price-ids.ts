/**
 * Stripe Price/Product IDs (LIVE) — Estúdio Mágico.
 * Gerado por scripts/create-stripe-products.mjs — sem secrets.
 * Nunca coloque sk_/whsec_ neste arquivo.
 */

export const STRIPE_PRICE_IDS = {
  starter: "price_1URZD42RGWYUXReL1LuaJkHI",
  family: "price_1URZD42RGWYUXReLwWbPWFkf",
  extra_story: "price_1URZD42RGWYUXReLzlaa8myj",
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
  extra_story: "prod_VSUByEpOj2mabF",
  "pack-1": "prod_VSUBNWkjUvC2u9",
  "pack-2": "prod_VSUBjZNwxKsFMs",
  "pack-3": "prod_VSUBtE4tfSzI8b",
  "pack-4": "prod_VSUBlwMeR8fPaM",
  "pack-5": "prod_VSUB5EMXIM0ijm",
  avatar_unit: "prod_VSUBrCXBKf2ite",
} as const;

export type StripePriceKey = keyof typeof STRIPE_PRICE_IDS;

export function stripePriceId(key: StripePriceKey): string {
  return STRIPE_PRICE_IDS[key];
}
