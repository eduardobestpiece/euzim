import { CHARACTER_PACKS, MONTHLY_STORY_LIMIT } from "@/lib/billing/character-packs";

/** Assinatura Família — brief MVP */
export const FAMILY_SUBSCRIPTION = {
  id: "family-monthly",
  planId: "family",
  name: "Assinatura Família",
  priceBrl: 49.9,
  priceCents: 4990,
  interval: "month" as const,
  storiesPerMonth: MONTHLY_STORY_LIMIT,
  includedCharacters: 1,
  description:
    "15 histórias/mês, avatar da criança e 1 personagem no primeiro mês.",
};

export type CheckoutKind = "subscription" | "character_pack";

export type CheckoutTarget =
  | { kind: "subscription" }
  | { kind: "character_pack"; packId: string };

export function resolveCharacterPack(packId: string) {
  return CHARACTER_PACKS.find((p) => p.id === packId) ?? null;
}

export function packPriceCents(packId: string): number | null {
  const pack = resolveCharacterPack(packId);
  if (!pack) return null;
  return Math.round(pack.priceBrl * 100);
}
