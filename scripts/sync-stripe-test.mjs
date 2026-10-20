/**
 * Espelha products/prices LIVE → TEST e grava stripe-price-ids.test.json.
 * Uso: node scripts/sync-stripe-test.mjs
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

const liveKey = process.env.STRIPE_SECRET_KEY?.trim() || "";
const testKey = process.env.STRIPE_SECRET_KEY_TEST?.trim() || "";
if (!liveKey.startsWith("sk_live_") && !liveKey.startsWith("rk_live_")) {
  console.error("BLOQUEIO: STRIPE_SECRET_KEY live ausente/inválida.");
  process.exit(2);
}
if (!testKey.startsWith("sk_test_") && !testKey.startsWith("rk_test_")) {
  console.error("BLOQUEIO: STRIPE_SECRET_KEY_TEST ausente/inválida.");
  process.exit(2);
}

const live = new Stripe(liveKey);
const test = new Stripe(testKey);

const LIVE = {
  starter: {
    price: "price_1URZD42RGWYUXReL1LuaJkHI",
    product: "prod_VSUBri2FlAVcly",
  },
  family: {
    price: "price_1URZD42RGWYUXReLwWbPWFkf",
    product: "prod_VSUBYLdM2LhWTn",
  },
  extra_story: {
    price: "price_1URZD42RGWYUXReLzlaa8myj",
    product: "prod_VSUByEpOj2mabF",
  },
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

const map = {
  generatedAt: new Date().toISOString(),
  source: "live",
  prices: {},
  products: {},
  liveToTestPrice: {},
  liveToTestProduct: {},
};

for (const [key, ids] of Object.entries(LIVE)) {
  const livePrice = await live.prices.retrieve(ids.price);
  const liveProduct = await live.products.retrieve(ids.product);
  const lookupKey = `euzim_${key}`;

  const listed = await test.products.list({ limit: 100, active: true });
  let testProduct =
    listed.data.find(
      (p) =>
        p.metadata?.euzim_key === key ||
        p.metadata?.plan_id === key ||
        p.metadata?.pack_id === key,
    ) || null;

  if (!testProduct) {
    testProduct = await test.products.create({
      name: liveProduct.name,
      description: liveProduct.description || undefined,
      metadata: {
        ...(liveProduct.metadata || {}),
        euzim_key: key,
        mirrored_from_live_product: ids.product,
        app: liveProduct.metadata?.app || "estudio-magico",
      },
    });
  } else {
    await test.products.update(testProduct.id, {
      name: liveProduct.name,
      description: liveProduct.description || undefined,
      metadata: {
        ...(testProduct.metadata || {}),
        ...(liveProduct.metadata || {}),
        euzim_key: key,
        mirrored_from_live_product: ids.product,
        app: liveProduct.metadata?.app || "estudio-magico",
      },
    });
  }

  let priceList = await test.prices.list({
    lookup_keys: [lookupKey],
    limit: 1,
    active: true,
  });
  let testPrice = priceList.data[0] || null;

  if (
    testPrice &&
    (testPrice.unit_amount !== livePrice.unit_amount ||
      testPrice.currency !== livePrice.currency ||
      String(testPrice.product) !== testProduct.id)
  ) {
    await test.prices.update(testPrice.id, { active: false });
    testPrice = null;
  }

  if (!testPrice) {
    testPrice = await test.prices.create({
      product: testProduct.id,
      unit_amount: livePrice.unit_amount ?? undefined,
      currency: livePrice.currency,
      ...(livePrice.recurring
        ? { recurring: { interval: livePrice.recurring.interval } }
        : {}),
      lookup_key: lookupKey,
      transfer_lookup_key: true,
      metadata: {
        euzim_key: key,
        mirrored_from_live_price: ids.price,
        ...(livePrice.metadata || {}),
      },
    });
  }

  map.prices[key] = testPrice.id;
  map.products[key] = testProduct.id;
  map.liveToTestPrice[ids.price] = testPrice.id;
  map.liveToTestProduct[ids.product] = testProduct.id;
  console.log(JSON.stringify({ key, testProduct: testProduct.id, testPrice: testPrice.id }));
}

const out = resolve(process.cwd(), "src/lib/billing/stripe-price-ids.test.json");
writeFileSync(out, `${JSON.stringify(map, null, 2)}\n`, "utf8");
console.log("WROTE", out, "mapped", Object.keys(map.prices).length);
