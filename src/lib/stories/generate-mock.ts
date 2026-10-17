export type GeneratedPage = {
  pageIndex: number;
  text: string;
  imageUrl: string;
  altText: string;
  chapterTitle?: string;
  imagePrompt?: string;
};

export type GeneratedStory = {
  title: string;
  pages: GeneratedPage[];
  coverImageUrl: string;
  textContent: {
    moral?: string;
    reviewNotes?: string;
    fullText?: string;
    pages: {
      index: number;
      text: string;
      title?: string;
      image_prompt?: string;
    }[];
  };
};

/** Fallback rico (6 atos) quando a OpenAI falha — ainda sem imagens Pixar. */
export function generateMockStory(input: {
  childName: string;
  friendName?: string;
  theme: string;
}): GeneratedStory {
  const name = input.childName.trim() || "a criança";
  const friend = input.friendName?.trim() || "Amigo";
  const theme = input.theme.trim() || "uma floresta encantada";
  const title = `${name}, ${friend} e o coração corajoso`;

  const texts = [
    `Num fim de tarde dourado, ${name} segurava ${friend} bem perto do peito. O tema dos pais ecoava como um sopro: ${theme}. ${name} sentia um nó pequenino na barriga — daqueles que apertam quando o mundo parece grande demais.`,
    `— Eu também fico com medo às vezes — sussurrou ${friend}. — Mas medo é como nuvem: passa se a gente caminha com luz. ${name} respirou fundo. Juntos decidiram dar o primeiro passo, sem pressa, com a mão e o coração unidos.`,
    `No caminho, encontraram alguém que também precisava de gentileza. ${name} hesitou. ${friend} lembrou: “Coragem não é não ter medo. É escolher o carinho mesmo com o peito apertado.” ${name} ofereceu um sorriso pequeno — e o mundo respondeu com calor.`,
    `Vieram dúvidas e sombras leves. ${name} quase voltou atrás. Então lembrou da própria história, da voz dos pais, e do olhar fiel de ${friend}. Fez uma escolha: ficar, escutar, entender — como quem acende uma lanterna no corredor.`,
    `A transformação chegou quietinha. O medo não sumiu de um estalo; virou respeito e compaixão. ${name} e ${friend} descobriram que ajudar é também se fortalecer. A cena brilhou como um final de filme Pixar: simples, emocionante, verdadeiro.`,
    `Em casa, ${name} contou a aventura em voz baixa. ${friend} dormiu no colo. E a moral — sem sermão — ficou no ar: quando caminhamos juntos, o medo diminui e o coração cresce. Fim.`,
  ];

  const pages: GeneratedPage[] = texts.map((text, pageIndex) => ({
    pageIndex,
    text,
    imageUrl: "",
    altText: `Parte ${pageIndex + 1} — ${title}`,
    chapterTitle: `Parte ${pageIndex + 1}`,
    imagePrompt: `Walt Disney Pixar 3D still of child ${name} with companion ${friend}, scene ${pageIndex + 1}, wholesome cinematic, no text`,
  }));

  return {
    title,
    pages,
    coverImageUrl: "",
    textContent: {
      moral: "Coragem e compaixão crescem quando caminhamos juntos.",
      pages: pages.map((p) => ({
        index: p.pageIndex,
        title: p.chapterTitle,
        text: p.text,
        image_prompt: p.imagePrompt,
      })),
    },
  };
}
