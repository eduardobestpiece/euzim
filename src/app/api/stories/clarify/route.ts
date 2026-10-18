import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-user";
import { STORY_AUX_MODEL } from "@/lib/stories/storyteller-skill";
import { meteredChatCompletion } from "@/lib/usage/openai-meter";

export const maxDuration = 60;

type ClarifyQuestion = {
  id: string;
  prompt: string;
};

/**
 * Clarify barato (low-token) com contexto de elenco/tema.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Faça login." }, { status: 401 });
  }

  let theme = "";
  let storyType = "";
  let languageLevel = "";
  let castNames: string[] = [];
  let protagonistName = "";
  let friendName = "";
  try {
    const body = (await request.json()) as {
      theme?: string;
      storyType?: string;
      languageLevel?: string;
      castNames?: string[];
      protagonistName?: string;
      friendName?: string;
    };
    theme = String(body.theme ?? "").trim();
    storyType = String(body.storyType ?? "").trim();
    languageLevel = String(body.languageLevel ?? "").trim();
    castNames = Array.isArray(body.castNames)
      ? body.castNames.map(String)
      : [];
    protagonistName = String(body.protagonistName ?? "").trim();
    friendName = String(body.friendName ?? "").trim();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (!theme) {
    return NextResponse.json({ error: "Informe o tema." }, { status: 400 });
  }

  const result = await meteredChatCompletion({
    userId: user.id,
    category: "story_clarify",
    operation: "clarify_theme",
    body: {
      model: STORY_AUX_MODEL,
      temperature: 0.3,
      max_tokens: 350,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Você ajuda pais a esclarecer temas de histórias infantis (Euzim).
Seja econômico em tokens: no máximo 3 perguntas curtas.
Se o tema já for claro e específico o bastante, responda needsClarify=false e questions=[].
Se for vago/ambíguo, faça 1 a 3 perguntas em português do Brasil.
Use o elenco informado para personalizar as perguntas quando útil.
Nunca peça temas de identidade de gênero ou ideologia.
Responda SOMENTE JSON:
{
  "needsClarify": boolean,
  "questions": [{ "id": "q1", "prompt": string }]
}`,
        },
        {
          role: "user",
          content: `Tipo: ${storyType || "(não informado)"}
Linguagem: ${languageLevel || "(não informada)"}
Protagonista: ${protagonistName || "(não informado)"}
Amigo: ${friendName || "(não informado)"}
Elenco: ${castNames.join(", ") || "(não informado)"}
Tema dos pais: """${theme}"""`,
        },
      ],
    },
    timeoutMs: 45_000,
  });

  if (!result.ok || !result.content) {
    return NextResponse.json({
      needsClarify: false,
      questions: [] as ClarifyQuestion[],
    });
  }

  try {
    const parsed = JSON.parse(result.content) as {
      needsClarify?: boolean;
      questions?: { id?: string; prompt?: string }[];
    };
    const questions: ClarifyQuestion[] = (parsed.questions ?? [])
      .map((q, i) => ({
        id: String(q.id ?? `q${i + 1}`),
        prompt: String(q.prompt ?? "").trim(),
      }))
      .filter((q) => q.prompt.length > 0)
      .slice(0, 3);

    return NextResponse.json({
      needsClarify: Boolean(parsed.needsClarify) && questions.length > 0,
      questions,
    });
  } catch {
    return NextResponse.json({
      needsClarify: false,
      questions: [] as ClarifyQuestion[],
    });
  }
}
