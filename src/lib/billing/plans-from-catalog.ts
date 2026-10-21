import type { PlanCatalogRow } from "@/lib/billing/plan-catalog";
import {
  DEFAULT_PLAN_CATALOG,
  getPlanCatalog,
} from "@/lib/billing/plan-catalog";
import type { StripePriceKey } from "@/lib/billing/stripe-price-ids";

export type StoryPlan = {
  id: string;
  planId: string;
  name: string;
  priceBrl: number;
  priceCents: number;
  interval: "month" | "one_time";
  storiesPerMonth: number;
  includedCharacters: number;
  description: string;
  kind: "subscription" | "extra_story";
  stripePriceKey?: StripePriceKey;
  forPlanId?: string;
};

function subscriptionFromRow(row: PlanCatalogRow): StoryPlan {
  return {
    id: `${row.planKey}-monthly`,
    planId: row.planKey,
    name: row.name,
    priceBrl: row.priceBrl,
    priceCents: row.priceCents,
    interval: "month",
    storiesPerMonth: row.storiesPerMonth,
    includedCharacters: row.avatarsIncluded,
    description: row.description,
    kind: "subscription",
  };
}

function extraStoryFromRow(row: PlanCatalogRow): StoryPlan {
  const stripeKey = `extra_story_${row.planKey}` as StripePriceKey;
  return {
    id: `extra-story-${row.planKey}`,
    planId: `extra_story_${row.planKey}`,
    name: "História adicional",
    priceBrl: row.extraStoryCents / 100,
    priceCents: row.extraStoryCents,
    interval: "one_time",
    storiesPerMonth: 1,
    includedCharacters: 0,
    description: `1 história extra (assinantes ${row.name}).`,
    kind: "extra_story",
    stripePriceKey: stripeKey,
    forPlanId: row.planKey,
  };
}

/** Monta planos de assinatura a partir do catálogo (sync, com defaults). */
export function subscriptionPlansFromCatalog(
  rows: PlanCatalogRow[] = DEFAULT_PLAN_CATALOG,
): StoryPlan[] {
  return rows.map(subscriptionFromRow);
}

export function extraStoryPlansFromCatalog(
  rows: PlanCatalogRow[] = DEFAULT_PLAN_CATALOG,
): Record<string, StoryPlan> {
  const out: Record<string, StoryPlan> = {};
  for (const row of rows) {
    out[row.planKey] = extraStoryFromRow(row);
  }
  return out;
}

export async function loadSubscriptionPlans(): Promise<StoryPlan[]> {
  const rows = await getPlanCatalog();
  return subscriptionPlansFromCatalog(rows);
}

export async function loadExtraStoryByPlan(): Promise<
  Record<string, StoryPlan>
> {
  const rows = await getPlanCatalog();
  return extraStoryPlansFromCatalog(rows);
}

export async function resolveSubscriptionPlanAsync(
  planId: string,
): Promise<StoryPlan | null> {
  const plans = await loadSubscriptionPlans();
  return plans.find((p) => p.planId === planId || p.id === planId) ?? null;
}

export async function extraStoryForPlanAsync(
  planId: string | null | undefined,
): Promise<StoryPlan> {
  const map = await loadExtraStoryByPlan();
  if (planId && map[planId]) return map[planId];
  return map.plus ?? extraStoryFromRow(DEFAULT_PLAN_CATALOG[2]!);
}

/** Preço unitário de avatar extra (usa family como referência; fallback 9,90). */
export async function extraAvatarUnitBrl(): Promise<number> {
  const rows = await getPlanCatalog();
  const row = rows.find((r) => r.planKey === "family") ?? rows[0];
  return row ? row.extraAvatarCents / 100 : 9.9;
}
