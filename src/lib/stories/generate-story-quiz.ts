import type { QuizQuestion } from "@/lib/stories/quiz";
import {
  STORY_TEXT_MODEL,
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
    const correctIndex = Number(r.correctIndex ?? r.correct_index);
    if (!prompt || options.length !== 4) continue;
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) {
      continue;
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
      model: STORY_TEXT_MODEL,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `${STORYTELLER_SKILL}

Você cria um QUIZ infantil fiel à história (não genérico).
Regras:
- 5 a 10 perguntas de múltipla escolha.
- Cada pergunta: 4 opções, exatamente 1 correta (correctIndex 0–3).
- Perguntas sobre personagens reais, eventos, escolhas e moral VIVIDA.
- Sem pegadinhas adultas; linguagem clara para 4–9 anos.
- Responda SOMENTE JSON:
{
  "questions": [
    {
      "id": "q1",
      "prompt": string,
      "options": [string, string, string, string],
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

Gere o quiz agora.`,
        },
      ],
    },
    timeoutMs: 120_000,
  });

  if (!result.ok || !result.content) return [];
  try {
    const parsed = JSON.parse(result.content) as { questions?: unknown };
    const questions = parseQuestions(parsed.questions);
    if (questions.length < 5) return questions.length ? questions : [];
    return questions.slice(0, 10);
  } catch {
    return [];
  }
}
