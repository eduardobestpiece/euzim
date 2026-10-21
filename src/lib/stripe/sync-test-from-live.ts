import type Stripe from "stripe";
import {
  STRIPE_PRICE_IDS,
  STRIPE_PRODUCT_IDS,
  type StripePriceKey,
} from "@/lib/billing/stripe-price-ids";
import {
  emptyStripePriceMap,
  STRIPE_TEST_PRICE_MAP_PATH,
  writeStripeTestPriceMap,
} from "@/lib/billing/stripe-price-map";
import { getStripeLive, getStripeTest } from "@/lib/stripe/client";

const PRICE_KEYS = Object.keys(STRIPE_PRICE_IDS) as StripePriceKey[];

export type SyncStripeResult = {
  ok: boolean;
  error?: string;
  mapped: number;
  keys: StripePriceKey[];
  mapPath: string;
  skippedLiveMutation: true;
  /** false quando o JSON de teste não mudou (evita HMR). */
  wrote?: boolean;
};

async function findTestProductByKey(
  test: Stripe,
  key: StripePriceKey,
): Promise<Stripe.Product | null> {
  const listed = await test.products.list({ limit: 100, active: true });
  const hit = listed.data.find(
    (p) =>
      p.metadata?.euzim_key === key ||
      p.metadata?.plan_id === key ||
      p.metadata?.pack_id === key,
  );
  return hit ?? null;
}

async function findTestPriceByLookup(
  test: Stripe,
  lookupKey: string,
): Promise<Stripe.Price | null> {
  const listed = await test.prices.list({
    lookup_keys: [lookupKey],
    limit: 1,
    active: true,
  });
  return listed.data[0] ?? null;
}

/**
 * Espelha products/prices LIVE → TEST (lookup_key + metadata euzim_key).
 * Nunca altera o catálogo live.
 */
export async function syncStripeTestFromLive(): Promise<SyncStripeResult> {
  const live = getStripeLive();
  const test = getStripeTest();
  if (!live) {
    return {
      ok: false,
      error: "STRIPE_SECRET_KEY (live) ausente/inválida — sync abortado.",
      mapped: 0,
      keys: [],
      mapPath: STRIPE_TEST_PRICE_MAP_PATH,
      skippedLiveMutation: true,
    };
  }
  if (!test) {
    return {
      ok: false,
      error: "STRIPE_SECRET_KEY_TEST ausente/inválida — sync abortado.",
      mapped: 0,
      keys: [],
      mapPath: STRIPE_TEST_PRICE_MAP_PATH,
      skippedLiveMutation: true,
    };
  }

  const map = emptyStripePriceMap();
  map.generatedAt = new Date().toISOString();

  for (const key of PRICE_KEYS) {
    const livePriceId = STRIPE_PRICE_IDS[key];
    const liveProductId = STRIPE_PRODUCT_IDS[key];

    const livePrice = await live.prices.retrieve(livePriceId);
    const liveProduct = await live.products.retrieve(liveProductId);

    const lookupKey = `euzim_${key}`;
    let testProduct = await findTestProductByKey(test, key);
    if (!testProduct) {
      testProduct = await test.products.create({
        name: liveProduct.name,
        description: liveProduct.description || undefined,
        metadata: {
          ...(liveProduct.metadata || {}),
          euzim_key: key,
          mirrored_from_live_product: liveProductId,
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
          mirrored_from_live_product: liveProductId,
          app: liveProduct.metadata?.app || "estudio-magico",
        },
      });
    }

    let testPrice = await findTestPriceByLookup(test, lookupKey);
    const unitAmount = livePrice.unit_amount;
    const currency = livePrice.currency;
    const recurring = livePrice.recurring
      ? { interval: livePrice.recurring.interval }
      : undefined;

    if (
      testPrice &&
      (testPrice.unit_amount !== unitAmount ||
        testPrice.currency !== currency ||
        String(testPrice.product) !== testProduct.id)
    ) {
      await test.prices.update(testPrice.id, { active: false });
      testPrice = null;
    }

    if (!testPrice) {
      testPrice = await test.prices.create({
        product: testProduct.id,
        unit_amount: unitAmount ?? undefined,
        currency,
        ...(recurring ? { recurring } : {}),
        lookup_key: lookupKey,
        transfer_lookup_key: true,
        metadata: {
          euzim_key: key,
          mirrored_from_live_price: livePriceId,
          ...(livePrice.metadata || {}),
        },
      });
    }

    map.prices[key] = testPrice.id;
    map.products[key] = testProduct.id;
    map.liveToTestPrice[livePriceId] = testPrice.id;
    map.liveToTestProduct[liveProductId] = testProduct.id;
  }

  const wrote = writeStripeTestPriceMap(map);

  return {
    ok: true,
    mapped: Object.keys(map.prices).length,
    keys: PRICE_KEYS,
    mapPath: STRIPE_TEST_PRICE_MAP_PATH,
    skippedLiveMutation: true,
    wrote,
  };
}
