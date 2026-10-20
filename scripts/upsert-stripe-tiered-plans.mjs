/**
 * Upsert catálogo Stripe LIVE: planos 2/5/10 + extras por tier.
 * Não apaga products; cria price novo só se unit_amount/recorrência mudarem.
 *
 * Uso: node scripts/upsert-stripe-tiered-plans.mjs
 * Depois: sync test via Admin ou syncStripeTestFromLive.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import Stripe from "stripe";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      const raw = readFileSync(resolve(process.cwd(), file), "utf8");
      for (const line of raw.split("\n")) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (m && !process.env[m[1]]) {
          process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
        }
      }
    } catch {
      /* ignore */
    }
  }
}

loadEnv();

const key = (process.env.STRIPE_SECRET_KEY || "").trim();
if (!key.startsWith("sk_live_") && !key.startsWith("rk_live_")) {
  console.error("BLOQUEIO: precisa STRIPE_SECRET_KEY live (sk_live_/rk_live_).");
  process.exit(2);
}

const stripe = new Stripe(key);

/** Specs canônicos (euzim_key = chave no código). */
const SPECS = [
  {
    key: "starter",
    name: "Euzim — Plano Aventureiros",
    description: "2 histórias por mês · R$ 24,90",
    metadata: {
      app: "estudio-magico",
      euzim_key: "starter",
      plan_id: "starter",
      stories_per_month: "2",
      included_characters: "2",
    },
    unit_amount: 2490,
    recurring: { interval: "month" },
    existingProductId: "prod_VSUBri2FlAVcly",
    existingPriceId: "price_1URZD42RGWYUXReL1LuaJkHI",
  },
  {
    key: "family",
    name: "Euzim — Plano Realizadores",
    description: "5 histórias por mês · R$ 49,90",
    metadata: {
      app: "estudio-magico",
      euzim_key: "family",
      plan_id: "family",
      stories_per_month: "5",
      included_characters: "2",
    },
    unit_amount: 4990,
    recurring: { interval: "month" },
    existingProductId: "prod_VSUBYLdM2LhWTn",
    existingPriceId: "price_1URZD42RGWYUXReLwWbPWFkf",
  },
  {
    key: "plus",
    name: "Euzim — Plano Plus",
    description: "10 histórias por mês · R$ 79,90",
    metadata: {
      app: "estudio-magico",
      euzim_key: "plus",
      plan_id: "plus",
      stories_per_month: "10",
      included_characters: "2",
    },
    unit_amount: 7990,
    recurring: { interval: "month" },
  },
  {
    key: "extra_story_starter",
    name: "Euzim — História adicional (Aventureiros)",
    description: "1 história extra para assinantes do plano R$ 24,90 · R$ 11,90",
    metadata: {
      app: "estudio-magico",
      euzim_key: "extra_story_starter",
      plan_id: "extra_story_starter",
      stories: "1",
      for_plan: "starter",
    },
    unit_amount: 1190,
  },
  {
    key: "extra_story_family",
    name: "Euzim — História adicional (Realizadores)",
    description: "1 história extra para assinantes do plano R$ 49,90 · R$ 9,90",
    metadata: {
      app: "estudio-magico",
      euzim_key: "extra_story_family",
      plan_id: "extra_story_family",
      stories: "1",
      for_plan: "family",
    },
    unit_amount: 990,
  },
  {
    key: "extra_story_plus",
    name: "Euzim — História adicional (Plus)",
    description: "1 história extra para assinantes do plano R$ 79,90 · R$ 7,90",
    metadata: {
      app: "estudio-magico",
      euzim_key: "extra_story_plus",
      plan_id: "extra_story_plus",
      stories: "1",
      for_plan: "plus",
    },
    unit_amount: 790,
  },
  /**
   * Legado: mantém o product/price antigo de R$ 7,90 apontando para Plus
   * (compatibilidade com checkouts/mapas antigos).
   */
  {
    key: "extra_story",
    name: "Euzim — História adicional",
    description: "1 história extra (pagamento único) — legado = tier Plus R$ 7,90",
    metadata: {
      app: "estudio-magico",
      euzim_key: "extra_story",
      plan_id: "extra_story",
      stories: "1",
      for_plan: "plus",
      legacy: "1",
    },
    unit_amount: 790,
    existingProductId: "prod_VSUByEpOj2mabF",
    existingPriceId: "price_1URZD42RGWYUXReLzlaa8myj",
  },
];

async function findProductByKey(key) {
  const listed = await stripe.products.list({ limit: 100, active: true });
  return (
    listed.data.find(
      (p) =>
        p.metadata?.euzim_key === key ||
        p.metadata?.plan_id === key ||
        p.metadata?.pack_id === key,
    ) ?? null
  );
}

async function ensureProduct(spec) {
  let product = null;
  if (spec.existingProductId) {
    try {
      product = await stripe.products.retrieve(spec.existingProductId);
    } catch {
      product = null;
    }
  }
  if (!product) product = await findProductByKey(spec.key);

  if (!product) {
    product = await stripe.products.create({
      name: spec.name,
      description: spec.description,
      metadata: spec.metadata,
    });
    console.log("CREATED_PRODUCT", spec.key, product.id);
  } else {
    product = await stripe.products.update(product.id, {
      name: spec.name,
      description: spec.description,
      metadata: {
        ...(product.metadata || {}),
        ...spec.metadata,
      },
      active: true,
    });
    console.log("UPDATED_PRODUCT", spec.key, product.id);
  }
  return product;
}

function priceMatches(price, spec, productId) {
  if (!price || !price.active) return false;
  if (String(price.product) !== productId) return false;
  if (price.unit_amount !== spec.unit_amount) return false;
  if (price.currency !== "brl") return false;
  const wantRecurring = Boolean(spec.recurring);
  const hasRecurring = Boolean(price.recurring);
  if (wantRecurring !== hasRecurring) return false;
  if (
    wantRecurring &&
    price.recurring?.interval !== spec.recurring.interval
  ) {
    return false;
  }
  return true;
}

async function ensurePrice(spec, product) {
  let price = null;
  if (spec.existingPriceId) {
    try {
      price = await stripe.prices.retrieve(spec.existingPriceId);
    } catch {
      price = null;
    }
  }

  if (price && !priceMatches(price, spec, product.id)) {
    await stripe.prices.update(price.id, { active: false });
    console.log("DEACTIVATED_PRICE", spec.key, price.id);
    price = null;
  }

  if (!price) {
    const listed = await stripe.prices.list({
      product: product.id,
      active: true,
      limit: 20,
    });
    price =
      listed.data.find((p) => priceMatches(p, spec, product.id)) ?? null;
  }

  if (!price) {
    price = await stripe.prices.create({
      product: product.id,
      unit_amount: spec.unit_amount,
      currency: "brl",
      ...(spec.recurring ? { recurring: spec.recurring } : {}),
      lookup_key: `euzim_${spec.key}`,
      transfer_lookup_key: true,
      metadata: spec.metadata,
    });
    console.log("CREATED_PRICE", spec.key, price.id);
  } else {
    price = await stripe.prices.update(price.id, {
      metadata: {
        ...(price.metadata || {}),
        ...spec.metadata,
      },
      // lookup_key só na criação; se já existe, ok
    });
    // Tenta anexar lookup_key se ainda não tiver
    if (!price.lookup_key) {
      try {
        price = await stripe.prices.update(price.id, {
          lookup_key: `euzim_${spec.key}`,
          transfer_lookup_key: true,
        });
      } catch (err) {
        console.warn(
          "LOOKUP_KEY_SKIP",
          spec.key,
          err instanceof Error ? err.message : err,
        );
      }
    }
    console.log("UPDATED_PRICE", spec.key, price.id);
  }
  return price;
}

const priceIds = {};
const productIds = {};

for (const spec of SPECS) {
  const product = await ensureProduct(spec);
  const price = await ensurePrice(spec, product);
  priceIds[spec.key] = price.id;
  productIds[spec.key] = product.id;
}

/** Packs/avatar_unit já existentes — preserva IDs atuais do arquivo. */
const EXISTING_PACKS = {
  "pack-1": {
    price: "price_1URZD52RGWYUXReLJBO4mGh2",
    product: "prod_VSUBNWkjUvC2u9",
  },
  "pack-2": {
    price: "price_1URZD52RGWYUXReL2BM6zjb0",
    product: "prod_VSUBjZNwxKsFMs",
  },
  "pack-3": {
    price: "price_1URZD52RGWYUXReLRDVVeoOA",
    product: "prod_VSUBtE4tfSzI8b",
  },
  "pack-4": {
    price: "price_1URZD62RGWYUXReLJy3Dl9LJ",
    product: "prod_VSUBlwMeR8fPaM",
  },
  "pack-5": {
    price: "price_1URZD62RGWYUXReLxApF8ILx",
    product: "prod_VSUB5EMXIM0ijm",
  },
  avatar_unit: {
    price: "price_1URZD62RGWYUXReLiZ2MHkJ9",
    product: "prod_VSUBrCXBKf2ite",
  },
};

for (const [k, v] of Object.entries(EXISTING_PACKS)) {
  priceIds[k] = v.price;
  productIds[k] = v.product;
}

const outPath = resolve(process.cwd(), "src/lib/billing/stripe-price-ids.ts");
const ts = `/**
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
  starter: "${priceIds.starter}",
  family: "${priceIds.family}",
  plus: "${priceIds.plus}",
  extra_story: "${priceIds.extra_story}",
  extra_story_starter: "${priceIds.extra_story_starter}",
  extra_story_family: "${priceIds.extra_story_family}",
  extra_story_plus: "${priceIds.extra_story_plus}",
  "pack-1": "${priceIds["pack-1"]}",
  "pack-2": "${priceIds["pack-2"]}",
  "pack-3": "${priceIds["pack-3"]}",
  "pack-4": "${priceIds["pack-4"]}",
  "pack-5": "${priceIds["pack-5"]}",
  /** Unidade R$ 9,90 — Checkout com quantity para 6+ */
  avatar_unit: "${priceIds.avatar_unit}",
} as const;

export const STRIPE_PRODUCT_IDS = {
  starter: "${productIds.starter}",
  family: "${productIds.family}",
  plus: "${productIds.plus}",
  extra_story: "${productIds.extra_story}",
  extra_story_starter: "${productIds.extra_story_starter}",
  extra_story_family: "${productIds.extra_story_family}",
  extra_story_plus: "${productIds.extra_story_plus}",
  "pack-1": "${productIds["pack-1"]}",
  "pack-2": "${productIds["pack-2"]}",
  "pack-3": "${productIds["pack-3"]}",
  "pack-4": "${productIds["pack-4"]}",
  "pack-5": "${productIds["pack-5"]}",
  avatar_unit: "${productIds.avatar_unit}",
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
`;

writeFileSync(outPath, ts, "utf8");
console.log("WROTE", outPath);
console.log(JSON.stringify({ priceIds, productIds }, null, 2));
