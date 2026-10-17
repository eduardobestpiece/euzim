import {
  shuffleAllQuizQuestions,
  type QuizQuestion,
} from "@/lib/stories/quiz";
import {
  STORY_AUX_MODEL,
  STORYTELLER_SKILL,
} from "@/lib/stories/storyteller-skill";
import { meteredChatCompletion } from "@/lib/usage/openai-meter";

function parseQuestions(raw: unknown): QuizQuestion[] {
  if (!Array.isArray(raw)) return [];
  const out: QuizQuestion[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const prompt = String(r.prompt ?? r.question ?? "").trim();
    const options = Array.isArray(r.options)
      ? r.options.map((o) => String(o).trim()).filter(Boolean)
      : [];
    let correctIndex = Number(r.correctIndex ?? r.correct_index);
    if (!prompt || options.length < 3 || options.length > 5) continue;
    if (
      !Number.isInteger(correctIndex) ||
      correctIndex < 0 ||
      correctIndex >= options.length
    ) {
      // Se o modelo errar o índice, assume primeira e o shuffle redistribui.
      correctIndex = 0;
    }
    out.push({
      id: String(r.id ?? `q${out.length + 1}`),
      prompt,
      options,
      correctIndex,
    });
  }
  return out;
}

/**
 * Gera 5–10 perguntas de quiz baseadas no texto real da história.
 * Opções: 3–5; correctIndex é redistribuído por shuffle pós-processamento.
 */
export async function generateStoryQuiz(input: {
  userId?: string | null;
  title: string;
  moral?: string;
  fullText: string;
  pages: { title?: string; text: string }[];
}): Promise<QuizQuestion[]> {
  const pageDigest = input.pages
    .map(
      (p, i) =>
        `Ato ${i + 1}${p.title ? ` (${p.title})` : ""}:\n${p.text.slice(0, 500)}`,
    )
    .join("\n\n");

  const result = await meteredChatCompletion({
    userId: input.userId,
    category: "story_quiz",
    operation: "generate_quiz",
    body: {
      model: STORY_AUX_MODEL,
      temperature: 0.55,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `${STORYTELLER_SKILL}

Você cria um QUIZ infantil REFLEXIVO fiel à história (não genérico).
Regras:
- 5 a 10 perguntas de múltipla escolha.
- Cada pergunta: 3 a 5 opções, exatamente 1 correta.
- Coloque a resposta correta em um índice ALEATÓRIO (não sempre 0).
- Pelo menos 1 pergunta REFLEXIVA ligada à lição vivida (não só "quem fez X?").
  Exemplos de tom (guie-se pela moral da história):
  • Segurança com adultos + presença dos pais (compaixão sem ir sozinho).
  • Empatia com pessoas em situação de rua (humanizar, sem ridicularizar).
  • Coragem vs. imprudência (passo corajoso COM cuidado).
- Perguntas também sobre personagens reais, eventos e escolhas.
- Sem pegadinhas adultas; linguagem clara para 4–9 anos.
- Responda SOMENTE JSON:
{
  "questions": [
    {
      "id": "q1",
      "prompt": string,
      "options": [string, string, string],
      "correctIndex": 0
    }
  ]
}`,
        },
        {
          role: "user",
          content: `Título: ${input.title}
Moral: ${input.moral || "(implícita)"}

TEXTO COMPLETO (resumo para quiz):
"""
${input.fullText.slice(0, 6000)}
"""

ATOS:
${pageDigest}

Gere o quiz agora. Inclua ≥1 pergunta reflexiva sobre a lição.`,
        },
      ],
    },
    timeoutMs: 120_000,
  });

  if (!result.ok || !result.content) return [];
  try {
    const parsed = JSON.parse(result.content) as { questions?: unknown };
    const questions = parseQuestions(parsed.questions);
    if (questions.length < 5) return questions.length ? shuffleAllQuizQuestions(questions) : [];
    return shuffleAllQuizQuestions(questions.slice(0, 10));
  } catch {
    return [];
  }
}
