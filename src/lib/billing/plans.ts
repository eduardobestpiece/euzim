import {
  CHARACTER_PACKS,
  EXTRA_AVATAR_UNIT_BRL,
  MONTHLY_STORY_LIMIT,
  priceForAvatarCount,
} from "@/lib/billing/character-packs";
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
  /** Price key Stripe (quando distinto de planId). */
  stripePriceKey?: StripePriceKey;
  /** Plano de assinatura ao qual o extra se aplica. */
  forPlanId?: string;
};

/** R$ 24,90/mês → 2 personagens + 2 histórias */
export const STARTER_SUBSCRIPTION: StoryPlan = {
  id: "starter-monthly",
  planId: "starter",
  name: "Para Aventureiros",
  priceBrl: 24.9,
  priceCents: 2490,
  interval: "month",
  storiesPerMonth: 2,
  includedCharacters: 2,
  description: "2 personagens e 2 histórias por mês para começar a aventura.",
  kind: "subscription",
};

/** R$ 49,90/mês → 2 avatares + 5 histórias */
export const FAMILY_SUBSCRIPTION: StoryPlan = {
  id: "family-monthly",
  planId: "family",
  name: "Para Realizadores",
  priceBrl: 49.9,
  priceCents: 4990,
  interval: "month",
  storiesPerMonth: 5,
  includedCharacters: 2,
  description: "2 avatares e 5 histórias por mês para criar com regularidade.",
  kind: "subscription",
};

/** R$ 79,90/mês → 2 avatares + 10 histórias */
export const PLUS_SUBSCRIPTION: StoryPlan = {
  id: "plus-monthly",
  planId: "plus",
  name: "Para Exploradores Plus",
  priceBrl: 79.9,
  priceCents: 7990,
  interval: "month",
  storiesPerMonth: 10,
  includedCharacters: 2,
  description: "2 avatares e 10 histórias por mês para criar sem freio.",
  kind: "subscription",
};

/** Extra one-shot — preço conforme plano ativo. */
export const EXTRA_STORY_STARTER: StoryPlan = {
  id: "extra-story-starter",
  planId: "extra_story_starter",
  name: "História adicional",
  priceBrl: 11.9,
  priceCents: 1190,
  interval: "one_time",
  storiesPerMonth: 1,
  includedCharacters: 0,
  description: "1 história extra (assinantes Aventureiros).",
  kind: "extra_story",
  stripePriceKey: "extra_story_starter",
  forPlanId: "starter",
};

export const EXTRA_STORY_FAMILY: StoryPlan = {
  id: "extra-story-family",
  planId: "extra_story_family",
  name: "História adicional",
  priceBrl: 9.9,
  priceCents: 990,
  interval: "one_time",
  storiesPerMonth: 1,
  includedCharacters: 0,
  description: "1 história extra (assinantes Realizadores).",
  kind: "extra_story",
  stripePriceKey: "extra_story_family",
  forPlanId: "family",
};

export const EXTRA_STORY_PLUS: StoryPlan = {
  id: "extra-story-plus",
  planId: "extra_story_plus",
  name: "História adicional",
  priceBrl: 7.9,
  priceCents: 790,
  interval: "one_time",
  storiesPerMonth: 1,
  includedCharacters: 0,
  description: "1 história extra (assinantes Plus).",
  kind: "extra_story",
  stripePriceKey: "extra_story_plus",
  forPlanId: "plus",
};

/** @deprecated alias do extra Plus — mantido para compat. */
export const EXTRA_STORY_PRODUCT: StoryPlan = {
  ...EXTRA_STORY_PLUS,
  id: "extra-story",
  planId: "extra_story",
  stripePriceKey: "extra_story",
};

export const SUBSCRIPTION_PLANS: StoryPlan[] = [
  STARTER_SUBSCRIPTION,
  FAMILY_SUBSCRIPTION,
  PLUS_SUBSCRIPTION,
];

export const EXTRA_STORY_BY_PLAN: Record<string, StoryPlan> = {
  starter: EXTRA_STORY_STARTER,
  family: EXTRA_STORY_FAMILY,
  plus: EXTRA_STORY_PLUS,
};

export const STORY_PLANS: StoryPlan[] = [
  ...SUBSCRIPTION_PLANS,
  EXTRA_STORY_STARTER,
  EXTRA_STORY_FAMILY,
  EXTRA_STORY_PLUS,
  EXTRA_STORY_PRODUCT,
];

export type CheckoutKind =
  | "subscription"
  | "character_pack"
  | "extra_story"
  | "custom_avatars";

export type CheckoutTarget =
  | { kind: "subscription"; planId?: string }
  | { kind: "character_pack"; packId: string }
  | { kind: "extra_story" }
  | { kind: "custom_avatars"; count: number };

export function resolveStoryPlan(planId: string): StoryPlan | null {
  return STORY_PLANS.find((p) => p.planId === planId || p.id === planId) ?? null;
}

export function resolveSubscriptionPlan(planId: string): StoryPlan | null {
  return (
    SUBSCRIPTION_PLANS.find((p) => p.planId === planId || p.id === planId) ??
    null
  );
}

/** Extra one-shot pelo plano de assinatura ativo (fallback: Plus / legado). */
export function extraStoryForPlan(planId: string | null | undefined): StoryPlan {
  if (planId && EXTRA_STORY_BY_PLAN[planId]) {
    return EXTRA_STORY_BY_PLAN[planId];
  }
  return EXTRA_STORY_PLUS;
}

export function resolveCharacterPack(packId: string) {
  return CHARACTER_PACKS.find((p) => p.id === packId) ?? null;
}

export function packPriceCents(packId: string): number | null {
  const pack = resolveCharacterPack(packId);
  if (!pack) return null;
  return Math.round(pack.priceBrl * 100);
}

export function customAvatarPriceCents(count: number): number | null {
  const brl = priceForAvatarCount(count);
  if (brl == null) return null;
  return Math.round(brl * 100);
}

export {
  CHARACTER_PACKS,
  EXTRA_AVATAR_UNIT_BRL,
  MONTHLY_STORY_LIMIT,
  priceForAvatarCount,
};
