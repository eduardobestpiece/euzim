export type GeneratedPage = {
  pageIndex: number;
  text: string;
  imageUrl: string;
  altText: string;
};

export type GeneratedStory = {
  title: string;
  pages: GeneratedPage[];
  coverImageUrl: string;
  textContent: { pages: { index: number; text: string }[] };
};

const UNSplash = [
  "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1472162072942-cd5147eb3902?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1516627145497-ae6968895b74?auto=format&fit=crop&w=800&q=80",
];

/** Gera 4 páginas mock (texto + imagem Unsplash) — sem IA real nesta fase. */
export function generateMockStory(input: {
  childName: string;
  theme: string;
}): GeneratedStory {
  const name = input.childName.trim() || "a criança";
  const theme = input.theme.trim() || "uma floresta encantada";
  const title = `${name} e ${theme}`;

  const texts = [
    `Em uma manhã dourada, ${name} encontrou um mapa brilhante que apontava para ${theme}. O coração batia forte de curiosidade.`,
    `No caminho, ${name} fez amizade com um guia gentil. Juntos atravessaram pontes de folhas e rios de luz.`,
    `No centro de ${theme}, havia um desafio: ajudar alguém que precisava de coragem. ${name} respirou fundo e deu o primeiro passo.`,
    `Com carinho e imaginação, ${name} resolveu o enigma. Voltou para casa com um sorriso e uma nova história para contar.`,
  ];

  const pages: GeneratedPage[] = texts.map((text, pageIndex) => ({
    pageIndex,
    text,
    imageUrl: UNSplash[pageIndex] ?? UNSplash[0],
    altText: `Ilustração da página ${pageIndex + 1} — ${name} em ${theme}`,
  }));

  return {
    title,
    pages,
    coverImageUrl: pages[0].imageUrl,
    textContent: {
      pages: pages.map((p) => ({ index: p.pageIndex, text: p.text })),
    },
  };
}
