export type QuizQuestion = {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
};

/** Gera 3 perguntas simples a partir do texto das páginas (mock terapêutico). */
export function buildQuizFromPages(
  title: string,
  pages: { text: string }[],
): QuizQuestion[] {
  const joined = pages.map((p) => p.text).join(" ");
  const nameMatch = joined.match(/\b([A-ZÁÉÍÓÚÂÊÔÃÕ][a-záéíóúâêôãõç]{2,})\b/);
  const hero = nameMatch?.[1] ?? "a criança";

  const themeHint =
    title.split(/\se\s/i)[1]?.trim() ||
    pages[0]?.text?.slice(0, 40) ||
    "a aventura";

  return [
    {
      id: "q1",
      prompt: `Quem é a estrela desta história?`,
      options: [hero, "Um dragão malvado", "Um robô do espaço", "Ninguém"],
      correctIndex: 0,
    },
    {
      id: "q2",
      prompt: `Sobre o que é a aventura?`,
      options: [
        themeHint.length > 60 ? `${themeHint.slice(0, 57)}…` : themeHint,
        "Uma corrida de carros",
        "Uma prova de matemática",
        "Um jogo de futebol",
      ],
      correctIndex: 0,
    },
    {
      id: "q3",
      prompt: `Como ${hero} se saiu no final?`,
      options: [
        "Com coragem e carinho, resolveu o desafio",
        "Desistiu e voltou sem tentar",
        "Ficou bravo com todo mundo",
        "Esqueceu o mapa em casa",
      ],
      correctIndex: 0,
    },
  ];
}
