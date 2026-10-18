export type CharacterPack = {
  id: string;
  name: string;
  characters: number;
  priceBrl: number;
  highlight?: boolean;
  description: string;
};

/** Pacotes fixos 1–5 avatares extras */
export const CHARACTER_PACKS: CharacterPack[] = [
  {
    id: "pack-1",
    name: "1 personagem extra",
    characters: 1,
    priceBrl: 17.9,
    description: "Adicione um herói ou amiguinho à biblioteca.",
  },
  {
    id: "pack-2",
    name: "2 personagens",
    characters: 2,
    priceBrl: 27.9,
    description: "Dupla para histórias em equipe.",
  },
  {
    id: "pack-3",
    name: "3 personagens",
    characters: 3,
    priceBrl: 34.9,
    highlight: true,
    description: "Mais escolhido pelas famílias.",
  },
  {
    id: "pack-4",
    name: "4 personagens",
    characters: 4,
    priceBrl: 42.9,
    description: "Elenco completo para sagas longas.",
  },
  {
    id: "pack-5",
    name: "5 personagens",
    characters: 5,
    priceBrl: 49.9,
    description: "Pacote familiar completo.",
  },
];

/** Preço unitário quando a família pede 6+ avatares no modal. */
export const EXTRA_AVATAR_UNIT_BRL = 9.9;

export function priceForAvatarCount(count: number): number | null {
  if (!Number.isInteger(count) || count < 1 || count > 15) return null;
  if (count <= 5) {
    const pack = CHARACTER_PACKS.find((p) => p.characters === count);
    return pack?.priceBrl ?? null;
  }
  return Math.round(count * EXTRA_AVATAR_UNIT_BRL * 100) / 100;
}

export function formatBrl(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** Limite padrão quando o plano não resolve (Família = 10). */
export const MONTHLY_STORY_LIMIT = 10;
