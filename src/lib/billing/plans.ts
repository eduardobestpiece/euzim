import {
  CHARACTER_PACKS,
  EXTRA_AVATAR_UNIT_BRL,
  MONTHLY_STORY_LIMIT,
  priceForAvatarCount,
} from "@/lib/billing/character-packs";

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
};

/** R$ 24,90/mês → 4 histórias */
export const STARTER_SUBSCRIPTION: StoryPlan = {
  id: "starter-monthly",
  planId: "starter",
  name: "Plano Essencial",
  priceBrl: 24.9,
  priceCents: 2490,
  interval: "month",
  storiesPerMonth: 4,
  includedCharacters: 2,
  description: "4 histórias por mês para começar a rotina mágica.",
  kind: "subscription",
};

/** R$ 49,90/mês → 10 histórias */
export const FAMILY_SUBSCRIPTION: StoryPlan = {
  id: "family-monthly",
  planId: "family",
  name: "Plano Família",
  priceBrl: 49.9,
  priceCents: 4990,
  interval: "month",
  storiesPerMonth: 10,
  includedCharacters: 3,
  description: "10 histórias/mês para a família criar juntas.",
  kind: "subscription",
};

/** R$ 7,90 → 1 história adicional (one-shot) */
export const EXTRA_STORY_PRODUCT: StoryPlan = {
  id: "extra-story",
  planId: "extra_story",
  name: "História adicional",
  priceBrl: 7.9,
  priceCents: 790,
  interval: "one_time",
  storiesPerMonth: 1,
  includedCharacters: 0,
  description: "Compre 1 história extra quando o limite do mês acabar.",
  kind: "extra_story",
};

export const STORY_PLANS: StoryPlan[] = [
  STARTER_SUBSCRIPTION,
  FAMILY_SUBSCRIPTION,
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

export { CHARACTER_PACKS, EXTRA_AVATAR_UNIT_BRL, MONTHLY_STORY_LIMIT, priceForAvatarCount };
