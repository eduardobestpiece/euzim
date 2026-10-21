import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  STRIPE_PRICE_IDS,
  STRIPE_PRODUCT_IDS,
} from "@/lib/billing/stripe-price-ids";
import { readStripeTestPriceMap } from "@/lib/billing/stripe-price-map";

export type PlanCatalogKey = "starter" | "family" | "plus";

export type PlanCatalogRow = {
  planKey: PlanCatalogKey;
  name: string;
  priceCents: number;
  priceBrl: number;
  storiesPerMonth: number;
  avatarsIncluded: number;
  extraStoryCents: number;
  extraAvatarCents: number;
  giftPointsFirst: number;
  giftPointsRecur: number;
  stripePriceIdLive: string | null;
  stripePriceIdTest: string | null;
  stripeProductIdLive: string | null;
  stripeProductIdTest: string | null;
  description: string;
  sortOrder: number;
};

/** Fallbacks = catálogo histórico (pré-Admin Planos). */
export const DEFAULT_PLAN_CATALOG: PlanCatalogRow[] = [
  {
    planKey: "starter",
    name: "Para Aventureiros",
    priceCents: 2490,
    priceBrl: 24.9,
    storiesPerMonth: 2,
    avatarsIncluded: 2,
    extraStoryCents: 1190,
    extraAvatarCents: 990,
    giftPointsFirst: 2,
    giftPointsRecur: 2,
    stripePriceIdLive: STRIPE_PRICE_IDS.starter,
    stripePriceIdTest: null,
    stripeProductIdLive: STRIPE_PRODUCT_IDS.starter,
    stripeProductIdTest: null,
    description:
      "2 personagens e 2 histórias por mês para começar a aventura.",
    sortOrder: 1,
  },
  {
    planKey: "family",
    name: "Para Realizadores",
    priceCents: 4990,
    priceBrl: 49.9,
    storiesPerMonth: 5,
    avatarsIncluded: 2,
    extraStoryCents: 990,
    extraAvatarCents: 990,
    giftPointsFirst: 4,
    giftPointsRecur: 4,
    stripePriceIdLive: STRIPE_PRICE_IDS.family,
    stripePriceIdTest: null,
    stripeProductIdLive: STRIPE_PRODUCT_IDS.family,
    stripeProductIdTest: null,
    description:
      "2 avatares e 5 histórias por mês para criar com regularidade.",
    sortOrder: 2,
  },
  {
    planKey: "plus",
    name: "Para Exploradores Plus",
    priceCents: 7990,
    priceBrl: 79.9,
    storiesPerMonth: 10,
    avatarsIncluded: 2,
    extraStoryCents: 790,
    extraAvatarCents: 990,
    giftPointsFirst: 4,
    giftPointsRecur: 4,
    stripePriceIdLive: STRIPE_PRICE_IDS.plus,
    stripePriceIdTest: null,
    stripeProductIdLive: STRIPE_PRODUCT_IDS.plus,
    stripeProductIdTest: null,
    description: "2 avatares e 10 histórias por mês para criar sem freio.",
    sortOrder: 3,
  },
];

const POINTS_STORY = 1;
const POINTS_AVATAR = 2;

export function storyPointsCost(stories: number): number {
  return Math.max(0, Math.floor(stories)) * POINTS_STORY;
}

export function avatarPointsCost(avatars: number): number {
  return Math.max(0, Math.floor(avatars)) * POINTS_AVATAR;
}

export function isPlanCatalogKey(value: string): value is PlanCatalogKey {
  return value === "starter" || value === "family" || value === "plus";
}

function rowFromDb(raw: Record<string, unknown>): PlanCatalogRow | null {
  const key = String(raw.plan_key || "");
  if (!isPlanCatalogKey(key)) return null;
  const priceCents = Number(raw.price_cents);
  if (!Number.isFinite(priceCents) || priceCents <= 0) return null;
  const testMap = readStripeTestPriceMap();
  return {
    planKey: key,
    name: String(raw.name || ""),
    priceCents,
    priceBrl: Math.round(priceCents) / 100,
    storiesPerMonth: Number(raw.stories_per_month) || 0,
    avatarsIncluded: Number(raw.avatars_included) || 0,
    extraStoryCents: Number(raw.extra_story_cents) || 0,
    extraAvatarCents: Number(raw.extra_avatar_cents) || 0,
    giftPointsFirst: Number(raw.gift_points_first) || 0,
    giftPointsRecur: Number(raw.gift_points_recur) || 0,
    stripePriceIdLive:
      (typeof raw.stripe_price_id_live === "string" &&
        raw.stripe_price_id_live) ||
      STRIPE_PRICE_IDS[key] ||
      null,
    stripePriceIdTest:
      (typeof raw.stripe_price_id_test === "string" &&
        raw.stripe_price_id_test) ||
      testMap.prices[key] ||
      null,
    stripeProductIdLive:
      (typeof raw.stripe_product_id_live === "string" &&
        raw.stripe_product_id_live) ||
      STRIPE_PRODUCT_IDS[key] ||
      null,
    stripeProductIdTest:
      (typeof raw.stripe_product_id_test === "string" &&
        raw.stripe_product_id_test) ||
      testMap.products[key] ||
      null,
    description: String(raw.description || ""),
    sortOrder: Number(raw.sort_order) || 0,
  };
}

let cache: { at: number; rows: PlanCatalogRow[] } | null = null;
const CACHE_MS = 15_000;

export function invalidatePlanCatalogCache() {
  cache = null;
}

export async function getPlanCatalog(options?: {
  force?: boolean;
}): Promise<PlanCatalogRow[]> {
  if (!options?.force && cache && Date.now() - cache.at < CACHE_MS) {
    return cache.rows;
  }

  const db = createAdminClient() ?? (await createClient());
  if (!db) {
    cache = { at: Date.now(), rows: DEFAULT_PLAN_CATALOG };
    return DEFAULT_PLAN_CATALOG;
  }

  const { data, error } = await db
    .from("plan_catalog")
    .select(
      "plan_key, name, price_cents, stories_per_month, avatars_included, extra_story_cents, extra_avatar_cents, gift_points_first, gift_points_recur, stripe_price_id_live, stripe_price_id_test, stripe_product_id_live, stripe_product_id_test, description, sort_order",
    )
    .order("sort_order", { ascending: true });

  if (error || !data?.length) {
    cache = { at: Date.now(), rows: DEFAULT_PLAN_CATALOG };
    return DEFAULT_PLAN_CATALOG;
  }

  const byKey = new Map<PlanCatalogKey, PlanCatalogRow>();
  for (const def of DEFAULT_PLAN_CATALOG) byKey.set(def.planKey, def);
  for (const raw of data) {
    const row = rowFromDb(raw as Record<string, unknown>);
    if (row) byKey.set(row.planKey, row);
  }

  const rows = DEFAULT_PLAN_CATALOG.map(
    (d) => byKey.get(d.planKey) ?? d,
  ).sort((a, b) => a.sortOrder - b.sortOrder);

  cache = { at: Date.now(), rows };
  return rows;
}

export async function getPlanCatalogRow(
  planKey: string,
): Promise<PlanCatalogRow | null> {
  if (!isPlanCatalogKey(planKey)) return null;
  const rows = await getPlanCatalog();
  return rows.find((r) => r.planKey === planKey) ?? null;
}

export function formatCentsBrl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
