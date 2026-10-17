export type QuizQuestion = {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
};

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
      options: options.slice(0, 4),
      correctIndex,
    });
  }
  return out;
}

/**
 * Fallback mínimo se a história não tiver quiz IA salvo.
 * Evita o mock antigo genérico ("Era" / dragão).
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

  return [
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
      prompt: `Como a história termina?`,
      options: [
        "Com coragem e carinho, o desafio foi enfrentado",
        "Todos desistiram sem tentar",
        "Ficaram bravos com todo mundo",
        "Esqueceram o mapa em casa",
      ],
      correctIndex: 0,
    },
  ];
}
