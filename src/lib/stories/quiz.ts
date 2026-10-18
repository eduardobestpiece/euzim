export type QuizQuestion = {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
};

/** Embaralha opções e recalcula correctIndex (Fisher–Yates). */
export function shuffleQuizOptions(question: QuizQuestion): QuizQuestion {
  const paired = question.options.map((text, index) => ({
    text,
    correct: index === question.correctIndex,
  }));
  for (let i = paired.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [paired[i], paired[j]] = [paired[j], paired[i]];
  }
  const options = paired.map((p) => p.text);
  const correctIndex = paired.findIndex((p) => p.correct);
  return {
    ...question,
    options,
    correctIndex: correctIndex >= 0 ? correctIndex : 0,
  };
}

export function shuffleAllQuizQuestions(
  questions: QuizQuestion[],
): QuizQuestion[] {
  return questions.map(shuffleQuizOptions);
}

/** Normaliza questions_data salvos na história. */
export function normalizeQuizQuestions(raw: unknown): QuizQuestion[] {
  if (!Array.isArray(raw)) return [];
  const out: QuizQuestion[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const prompt = String(r.prompt ?? r.question ?? "").trim();
    const options = Array.isArray(r.options)
      ? r.options.map((o) => String(o).trim()).filter(Boolean)
      : [];
    const correctIndex = Number(r.correctIndex ?? r.correct_index);
    if (!prompt || options.length < 2) continue;
    if (
      !Number.isInteger(correctIndex) ||
      correctIndex < 0 ||
      correctIndex >= options.length
    ) {
      continue;
    }
    out.push({
      id: String(r.id ?? `q${out.length + 1}`),
      prompt,
      options: options.slice(0, 5),
      correctIndex,
    });
  }
  return out;
}

/**
 * Fallback mínimo se a história não tiver quiz IA salvo.
 * Opções já saem shuffled.
 */
export function buildQuizFromPages(
  title: string,
  pages: { text: string }[],
): QuizQuestion[] {
  const joined = pages.map((p) => p.text).join(" ").trim();
  const names = Array.from(
    joined.matchAll(/\b([A-ZÁÉÍÓÚÂÊÔÃÕ][a-záéíóúâêôãõç]{2,})\b/g),
  )
    .map((m) => m[1])
    .filter((n, i, arr) => arr.indexOf(n) === i)
    .slice(0, 4);

  const hero = names[0] ?? "a criança";
  const friend = names[1] ?? "o amigo";
  const snippet =
    pages[0]?.text?.replace(/\s+/g, " ").trim().slice(0, 80) || title;

  const raw: QuizQuestion[] = [
    {
      id: "fallback-q1",
      prompt: `Quem é a estrela de “${title}”?`,
      options: [
        hero,
        friend,
        "Um personagem que não aparece",
        "Ninguém desta história",
      ],
      correctIndex: 0,
    },
    {
      id: "fallback-q2",
      prompt: `O que acontece no começo?`,
      options: [
        snippet.length > 60 ? `${snippet.slice(0, 57)}…` : snippet,
        "Uma corrida de foguetes",
        "Uma prova de matemática",
        "Um jogo de futebol no espaço",
      ],
      correctIndex: 0,
    },
    {
      id: "fallback-q3",
      prompt: `O que a história ensina sobre coragem e cuidado?`,
      options: [
        "Ser corajoso e ainda assim ficar perto de um adulto de confiança",
        "Ir sozinho sem contar para ninguém",
        "Desistir quando o medo aparecer",
        "Rir de quem precisa de ajuda",
        "Esconder o medo e fingir que nada aconteceu",
      ],
      correctIndex: 0,
    },
  ];

  return shuffleAllQuizQuestions(raw);
}
