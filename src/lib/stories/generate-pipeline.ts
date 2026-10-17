import type { GeneratedPage, GeneratedStory } from "@/lib/stories/generate-mock";
import { generateMockStory } from "@/lib/stories/generate-mock";
import type { StoryCast } from "@/lib/stories/story-cast";
import {
  MAX_STORY_PAGES,
  MIN_STORY_PAGES,
  STORYTELLER_SKILL,
  STORY_TEXT_MODEL,
  TARGET_WORDS_PER_PAGE,
} from "@/lib/stories/storyteller-skill";

export type StoryEngine =
  | "openai-storyteller-v1"
  | "openai-gpt-4o-mini"
  | "mock-v1";

export type StoryChapter = {
  index: number;
  title: string;
  text: string;
  imagePrompt: string;
};

export type PipelineStory = {
  title: string;
  moral: string;
  pages: StoryChapter[];
  fullText: string;
  reviewNotes: string;
};

function apiKey(): string | null {
  return process.env.OPENAI_API_KEY?.trim() || null;
}

async function chatJson(input: {
  system: string;
  user: string;
  temperature?: number;
}): Promise<Record<string, unknown> | null> {
  const key = apiKey();
  if (!key) return null;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: STORY_TEXT_MODEL,
      temperature: input.temperature ?? 0.75,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.user },
      ],
    }),
    signal: AbortSignal.timeout(180_000),
  });

  if (!res.ok) return null;
  const payload = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = payload.choices?.[0]?.message?.content;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function castBrief(cast: StoryCast): string {
  const age =
    cast.childAgeYears != null ? `${cast.childAgeYears} anos` : "idade infantil";
  const friendLabel =
    cast.friendKind === "pet" ? "pet companheiro" : "brinquedo favorito";
  return [
    `Criança protagonista: ${cast.childName} (${age}${cast.childGender ? `, ${cast.childGender}` : ""}).`,
    `Co-protagonista: ${cast.friendName} (${friendLabel}).`,
    `Os dois precisam estar juntos na essência de quase todas as cenas.`,
  ].join("\n");
}

/** Passo 1 — rascunho longo contínuo. */
async function draftFullStory(
  cast: StoryCast,
  theme: string,
): Promise<{ title: string; moral: string; fullText: string } | null> {
  const parsed = await chatJson({
    temperature: 0.85,
    system: `${STORYTELLER_SKILL}

Responda SOMENTE JSON:
{
  "title": string,
  "moral": string (1 frase suave, sem "a lição é"),
  "full_text": string (história completa contínua, 900–1600 palavras, com diálogos e cenas)
}`,
    user: `${castBrief(cast)}

Pedido / tema dos pais:
"""${theme}"""

Escreva a história completa (ainda sem dividir em páginas). Profunda, oral, cinematográfica.`,
  });
  if (!parsed) return null;
  const title = String(parsed.title ?? "").trim();
  const moral = String(parsed.moral ?? "").trim();
  const fullText = String(parsed.full_text ?? "").trim();
  if (!title || fullText.split(/\s+/).length < 400) return null;
  return { title, moral, fullText };
}

/** Passo 2 — revisão crítica e reescrita. */
async function reviewStory(
  cast: StoryCast,
  theme: string,
  draft: { title: string; moral: string; fullText: string },
): Promise<{
  title: string;
  moral: string;
  fullText: string;
  reviewNotes: string;
} | null> {
  const parsed = await chatJson({
    temperature: 0.55,
    system: `${STORYTELLER_SKILL}

Você agora é o EDITOR-SÁBIO. Critique e REESCREVA.

Checklist obrigatório:
- Protagonistas corretos (${cast.childName} + ${cast.friendName})?
- Tema dos pais atendido com profundidade (não raso)?
- Arco completo (desejo, obstáculo, escolha, transformação)?
- Adequado a criança? Empático?
- Linguagem oral, rica, sem moral pregada?

Responda SOMENTE JSON:
{
  "title": string,
  "moral": string,
  "full_text": string (versão FINAL melhorada, 900–1600 palavras),
  "review_notes": string (o que melhorou, em 2–4 frases)
}`,
    user: `${castBrief(cast)}

Tema dos pais: """${theme}"""

Título rascunho: ${draft.title}
Moral rascunho: ${draft.moral}

TEXTO RASCUNHO:
"""
${draft.fullText}
"""

Reescreva a melhor versão possível.`,
  });
  if (!parsed) return null;
  const title = String(parsed.title ?? draft.title).trim();
  const moral = String(parsed.moral ?? draft.moral).trim();
  const fullText = String(parsed.full_text ?? "").trim();
  const reviewNotes = String(parsed.review_notes ?? "").trim();
  if (fullText.split(/\s+/).length < 400) return null;
  return { title, moral, fullText, reviewNotes };
}

/** Passo 3 — fracionar em 5–10 atos com prompts de imagem. */
async function splitIntoChapters(
  cast: StoryCast,
  reviewed: {
    title: string;
    moral: string;
    fullText: string;
    reviewNotes: string;
  },
): Promise<StoryChapter[] | null> {
  const parsed = await chatJson({
    temperature: 0.4,
    system: `${STORYTELLER_SKILL}

Divida a história FINAL em ${MIN_STORY_PAGES} a ${MAX_STORY_PAGES} ATOS/páginas.
Cada ato: ~${TARGET_WORDS_PER_PAGE} palavras (±40), com começo/meio/fim de cena,
diálogos quando couber, e um image_prompt em INGLÊS para ilustração Walt Disney/Pixar 3D.

Regras do image_prompt:
- Citar visualmente a criança "${cast.childName}" e o amigo "${cast.friendName}" (${cast.friendKind}).
- Estilo: "Walt Disney / Pixar 3D animated still, cinematic soft lighting, wholesome"
- Sem texto na imagem, sem watermark, family-friendly.

Responda SOMENTE JSON:
{
  "pages": [
    {
      "index": 0,
      "title": string,
      "text": string (português),
      "image_prompt": string (inglês)
    }
  ]
}
Use entre ${MIN_STORY_PAGES} e ${MAX_STORY_PAGES} itens, índices 0..n-1.`,
    user: `Título: ${reviewed.title}
Moral: ${reviewed.moral}

HISTÓRIA FINAL:
"""
${reviewed.fullText}
"""

Fracione agora.`,
  });
  if (!parsed) return null;
  const pagesRaw = Array.isArray(parsed.pages) ? parsed.pages : [];
  const chapters: StoryChapter[] = [];
  for (const row of pagesRaw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const text = String(r.text ?? "").trim();
    const imagePrompt = String(r.image_prompt ?? "").trim();
    const title = String(r.title ?? "").trim() || `Parte ${chapters.length + 1}`;
    if (text.length < 80) continue;
    chapters.push({
      index: chapters.length,
      title,
      text,
      imagePrompt:
        imagePrompt ||
        `Walt Disney / Pixar 3D animated still of child ${cast.childName} with ${cast.friendKind} ${cast.friendName}, wholesome cinematic lighting, no text`,
    });
  }
  if (chapters.length < MIN_STORY_PAGES) return null;
  return chapters.slice(0, MAX_STORY_PAGES);
}

export type GeneratePipelineResult = {
  story: GeneratedStory;
  pipeline: PipelineStory;
  engine: StoryEngine;
};

/**
 * Pipeline: rascunho → revisão → 5–10 atos.
 * Imagens ainda placeholder; quem preenche é generateStoryImages.
 */
export async function generateStoryPipeline(input: {
  cast: StoryCast;
  theme: string;
}): Promise<GeneratePipelineResult> {
  const theme = input.theme.trim();
  const cast = input.cast;

  const draft = await draftFullStory(cast, theme);
  if (!draft) {
    return {
      story: generateMockStory({
        childName: cast.childName,
        friendName: cast.friendName,
        theme,
      }),
      pipeline: {
        title: `${cast.childName} e ${theme}`,
        moral: "",
        pages: [],
        fullText: "",
        reviewNotes: "fallback mock",
      },
      engine: "mock-v1",
    };
  }

  const reviewed =
    (await reviewStory(cast, theme, draft)) ?? {
      ...draft,
      reviewNotes: "revisão pulada — usando rascunho",
    };

  const chapters = await splitIntoChapters(cast, reviewed);
  if (!chapters) {
    // Divide o texto revisado em 6 blocos simples
    const words = reviewed.fullText.split(/\s+/);
    const chunks = 6;
    const size = Math.ceil(words.length / chunks);
    const fallback: StoryChapter[] = Array.from({ length: chunks }, (_, i) => {
      const text = words.slice(i * size, (i + 1) * size).join(" ");
      return {
        index: i,
        title: `Parte ${i + 1}`,
        text,
        imagePrompt: `Walt Disney / Pixar 3D animated still of ${cast.childName} and ${cast.friendName}, scene ${i + 1}, wholesome, no text`,
      };
    });
    return packResult(reviewed, fallback, "openai-storyteller-v1");
  }

  return packResult(reviewed, chapters, "openai-storyteller-v1");
}

function packResult(
  reviewed: {
    title: string;
    moral: string;
    fullText: string;
    reviewNotes: string;
  },
  chapters: StoryChapter[],
  engine: StoryEngine,
): GeneratePipelineResult {
  const pages: GeneratedPage[] = chapters.map((c) => ({
    pageIndex: c.index,
    text: c.text,
    imageUrl: "",
    altText: `${c.title} — ${reviewed.title}`,
    chapterTitle: c.title,
    imagePrompt: c.imagePrompt,
  }));

  return {
    story: {
      title: reviewed.title,
      pages,
      coverImageUrl: "",
      textContent: {
        moral: reviewed.moral,
        reviewNotes: reviewed.reviewNotes,
        fullText: reviewed.fullText,
        pages: pages.map((p) => ({
          index: p.pageIndex,
          title: p.chapterTitle,
          text: p.text,
          image_prompt: p.imagePrompt,
        })),
      },
    },
    pipeline: {
      title: reviewed.title,
      moral: reviewed.moral,
      pages: chapters,
      fullText: reviewed.fullText,
      reviewNotes: reviewed.reviewNotes,
    },
    engine,
  };
}
