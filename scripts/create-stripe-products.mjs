/**
 * Cria Products/Prices Stripe LIVE do Estúdio Mágico e grava IDs em
 * src/lib/billing/stripe-price-ids.ts (sem secrets).
 *
 * Uso: node scripts/create-stripe-products.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import Stripe from "stripe";

function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    /* ignore */
  }
}

loadEnv();

const key = process.env.STRIPE_SECRET_KEY?.trim() || "";
if (
  !key ||
  key.startsWith("mk_") ||
  !(key.startsWith("sk_") || key.startsWith("rk_"))
) {
  console.error(
    "BLOQUEIO: STRIPE_SECRET_KEY ausente ou inválida (sk_live_/rk_live_).",
  );
  process.exit(2);
}

const stripe = new Stripe(key);

const PRODUCTS = [
  {
    key: "starter",
    name: "Estúdio Mágico — Plano Essencial",
    description: "4 histórias por mês",
    metadata: { plan_id: "starter", stories_per_month: "4", app: "estudio-magico" },
    price: {
      unit_amount: 2490,
      currency: "brl",
      recurring: { interval: "month" },
    },
  },
  {
    key: "family",
    name: "Estúdio Mágico — Plano Família",
    description: "10 histórias por mês",
    metadata: { plan_id: "family", stories_per_month: "10", app: "estudio-magico" },
    price: {
      unit_amount: 4990,
      currency: "brl",
      recurring: { interval: "month" },
    },
  },
  {
    key: "extra_story",
    name: "Estúdio Mágico — História adicional",
    description: "1 história extra (pagamento único)",
    metadata: { plan_id: "extra_story", stories: "1", app: "estudio-magico" },
    price: { unit_amount: 790, currency: "brl" },
  },
  {
    key: "pack-1",
    name: "Estúdio Mágico — 1 personagem extra",
    description: "1 avatar extra",
    metadata: { pack_id: "pack-1", characters: "1", app: "estudio-magico" },
    price: { unit_amount: 1790, currency: "brl" },
  },
  {
    key: "pack-2",
    name: "Estúdio Mágico — 2 personagens",
    description: "2 avatares extras",
    metadata: { pack_id: "pack-2", characters: "2", app: "estudio-magico" },
    price: { unit_amount: 2790, currency: "brl" },
  },
  {
    key: "pack-3",
    name: "Estúdio Mágico — 3 personagens",
    description: "3 avatares extras",
    metadata: { pack_id: "pack-3", characters: "3", app: "estudio-magico" },
    price: { unit_amount: 3490, currency: "brl" },
  },
  {
    key: "pack-4",
    name: "Estúdio Mágico — 4 personagens",
    description: "4 avatares extras",
    metadata: { pack_id: "pack-4", characters: "4", app: "estudio-magico" },
    price: { unit_amount: 4290, currency: "brl" },
  },
  {
    key: "pack-5",
    name: "Estúdio Mágico — 5 personagens",
    description: "5 avatares extras",
    metadata: { pack_id: "pack-5", characters: "5", app: "estudio-magico" },
    price: { unit_amount: 4990, currency: "brl" },
  },
  {
    key: "avatar_unit",
    name: "Estúdio Mágico — Avatar extra (unidade)",
    description: "R$ 9,90 por avatar (6+ via quantidade no Checkout)",
    metadata: {
      pack_id: "avatar_unit",
      unit_brl: "9.90",
      app: "estudio-magico",
    },
    price: { unit_amount: 990, currency: "brl" },
  },
];

const created = {};

for (const spec of PRODUCTS) {
  const product = await stripe.products.create({
    name: spec.name,
    description: spec.description,
    metadata: spec.metadata,
  });
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: spec.price.unit_amount,
    currency: spec.price.currency,
    ...(spec.price.recurring ? { recurring: spec.price.recurring } : {}),
    metadata: spec.metadata,
  });
  created[spec.key] = {
    productId: product.id,
    priceId: price.id,
    unitAmount: spec.price.unit_amount,
  };
  console.log(
    JSON.stringify({
      key: spec.key,
      product: product.id,
      price: price.id,
    }),
  );
}

const ts = `/**
 * Stripe Price/Product IDs (LIVE) — Estúdio Mágico.
 * Gerado por scripts/create-stripe-products.mjs — sem secrets.
 * Nunca coloque sk_/whsec_ neste arquivo.
 */

export const STRIPE_PRICE_IDS = {
  starter: "${created.starter.priceId}",
  family: "${created.family.priceId}",
  extra_story: "${created.extra_story.priceId}",
  "pack-1": "${created["pack-1"].priceId}",
  "pack-2": "${created["pack-2"].priceId}",
  "pack-3": "${created["pack-3"].priceId}",
  "pack-4": "${created["pack-4"].priceId}",
  "pack-5": "${created["pack-5"].priceId}",
  /** Unidade R$ 9,90 — Checkout com quantity para 6+ */
  avatar_unit: "${created.avatar_unit.priceId}",
} as const;

export const STRIPE_PRODUCT_IDS = {
  starter: "${created.starter.productId}",
  family: "${created.family.productId}",
  extra_story: "${created.extra_story.productId}",
  "pack-1": "${created["pack-1"].productId}",
  "pack-2": "${created["pack-2"].productId}",
  "pack-3": "${created["pack-3"].productId}",
  "pack-4": "${created["pack-4"].productId}",
  "pack-5": "${created["pack-5"].productId}",
  avatar_unit: "${created.avatar_unit.productId}",
} as const;

export type StripePriceKey = keyof typeof STRIPE_PRICE_IDS;

export function stripePriceId(key: StripePriceKey): string {
  return STRIPE_PRICE_IDS[key];
}
`;

const outPath = resolve(process.cwd(), "src/lib/billing/stripe-price-ids.ts");
writeFileSync(outPath, ts, "utf8");
console.log("WROTE", outPath);

// List confirmation
const listed = await stripe.products.list({ limit: 20, active: true });
const ours = listed.data.filter((p) => p.metadata?.app === "estudio-magico");
console.log(
  "LIST_OK",
  ours.map((p) => ({ id: p.id, name: p.name })).length,
  "estudio-magico products",
);
