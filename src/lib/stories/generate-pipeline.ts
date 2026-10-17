import type { GeneratedPage, GeneratedStory } from "@/lib/stories/generate-mock";
import { generateMockStory } from "@/lib/stories/generate-mock";
import type { StoryCast } from "@/lib/stories/story-cast";
import {
  MAX_STORY_PAGES,
  MIN_STORY_PAGES,
  STORYTELLER_SKILL,
  STORY_TEXT_MODEL,
  TARGET_WORDS_PER_PAGE,
  storyTypeGuidance,
  type StoryType,
  type WordVolume,
  WORD_VOLUME_TARGETS,
} from "@/lib/stories/storyteller-skill";
import { meteredChatCompletion } from "@/lib/usage/openai-meter";

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

export type PipelineOptions = {
  userId?: string | null;
  storyType?: StoryType;
  wordTarget?: number;
  wordVolume?: WordVolume;
  clarifyAnswers?: Record<string, string>;
  castNames?: string[];
  protagonistName?: string;
};

async function chatJson(input: {
  userId?: string | null;
  operation: string;
  system: string;
  user: string;
  temperature?: number;
}): Promise<Record<string, unknown> | null> {
  const result = await meteredChatCompletion({
    userId: input.userId,
    category: "story_text",
    operation: input.operation,
    body: {
      model: STORY_TEXT_MODEL,
      temperature: input.temperature ?? 0.75,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.user },
      ],
    },
    timeoutMs: 180_000,
  });

  if (!result.ok || !result.content) return null;
  try {
    return JSON.parse(result.content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function castBrief(cast: StoryCast, opts?: PipelineOptions): string {
  const age =
    cast.childAgeYears != null ? `${cast.childAgeYears} anos` : "idade infantil";
  const friendLabel =
    cast.friendKind === "pet" ? "pet companheiro" : "brinquedo favorito";
  const protagonist =
    opts?.protagonistName?.trim() || cast.childName;
  const castLine =
    opts?.castNames && opts.castNames.length > 0
      ? `Elenco selecionado: ${opts.castNames.join(", ")}.`
      : "";
  return [
    `Criança protagonista: ${protagonist} (${age}${cast.childGender ? `, ${cast.childGender}` : ""}).`,
    `Co-protagonista: ${cast.friendName} (${friendLabel}).`,
    castLine,
    `Os dois precisam estar juntos na essência de quase todas as cenas.`,
  ]
    .filter(Boolean)
    .join("\n");
}

function volumeBrief(opts?: PipelineOptions): {
  min: number;
  max: number;
  target: number;
} {
  const target =
    opts?.wordTarget ??
    (opts?.wordVolume
      ? WORD_VOLUME_TARGETS[opts.wordVolume].words
      : 1200);
  const min = Math.max(400, Math.round(target * 0.85));
  const max = Math.round(target * 1.2);
  return { min, max, target };
}

function typeBrief(opts?: PipelineOptions): string {
  if (!opts?.storyType) return "";
  return `Tipo de história: ${opts.storyType}. ${storyTypeGuidance(opts.storyType)}`;
}

function clarifyBrief(opts?: PipelineOptions): string {
  if (!opts?.clarifyAnswers || Object.keys(opts.clarifyAnswers).length === 0) {
    return "";
  }
  return [
    "Respostas de esclarecimento dos pais:",
    ...Object.entries(opts.clarifyAnswers).map(
      ([q, a]) => `- ${q}: ${a}`,
    ),
  ].join("\n");
}

/** Passo 1 — rascunho longo contínuo. */
async function draftFullStory(
  cast: StoryCast,
  theme: string,
  opts?: PipelineOptions,
): Promise<{ title: string; moral: string; fullText: string } | null> {
  const vol = volumeBrief(opts);
  const parsed = await chatJson({
    userId: opts?.userId,
    operation: "draft_story",
    temperature: 0.85,
    system: `${STORYTELLER_SKILL}

Responda SOMENTE JSON:
{
  "title": string,
  "moral": string (1 frase suave, sem "a lição é"),
  "full_text": string (história completa contínua, OBRIGATÓRIO ${vol.min}–${vol.max} palavras, com diálogos e cenas)
}
Meta de volume: ~${vol.target} palavras. Se o texto tiver menos de ${vol.min} palavras, continue expandindo cenas antes de responder.`,
    user: `${castBrief(cast, opts)}

${typeBrief(opts)}
${clarifyBrief(opts)}

Pedido / tema dos pais:
"""${theme}"""

Escreva a história completa (ainda sem dividir em páginas). Profunda, oral, cinematográfica.
Meta ~${vol.target} palavras. Inclua cenas distintas e diálogos entre a criança e o amigo.
Se o tema envolve rua/desconhecidos/vulnerabilidade, inclua pais/cuidadores presentes.`,
  });
  if (!parsed) return null;
  const title = String(parsed.title ?? "").trim();
  const moral = String(parsed.moral ?? "").trim();
  const fullText = String(parsed.full_text ?? "").trim();
  const minWords = Math.min(700, Math.round(vol.min * 0.7));
  if (!title || fullText.split(/\s+/).length < minWords) return null;
  return { title, moral, fullText };
}

/** Passo 2 — revisão crítica e reescrita. */
async function reviewStory(
  cast: StoryCast,
  theme: string,
  draft: { title: string; moral: string; fullText: string },
  opts?: PipelineOptions,
): Promise<{
  title: string;
  moral: string;
  fullText: string;
  reviewNotes: string;
} | null> {
  const vol = volumeBrief(opts);
  const parsed = await chatJson({
    userId: opts?.userId,
    operation: "review_story",
    temperature: 0.55,
    system: `${STORYTELLER_SKILL}

Você agora é o EDITOR-SÁBIO. Critique e REESCREVA.

Checklist obrigatório:
- Protagonistas corretos (${opts?.protagonistName || cast.childName} + ${cast.friendName})?
- Tema dos pais atendido com profundidade (não raso)?
- Segurança parental em cenas públicas/estranhos?
- Sem agenda de identidade de gênero / ideologia?
- Arco completo (desejo, obstáculo, escolha, transformação)?
- Adequado a criança? Empático?
- Linguagem oral, rica, sem moral pregada?

Responda SOMENTE JSON:
{
  "title": string,
  "moral": string,
  "full_text": string (versão FINAL melhorada, ~${vol.target} palavras),
  "review_notes": string (o que melhorou, em 2–4 frases)
}`,
    user: `${castBrief(cast, opts)}

${typeBrief(opts)}
${clarifyBrief(opts)}

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

/** Passo 3 — fracionar em 5–10 atos com prompts de imagem únicos. */
async function splitIntoChapters(
  cast: StoryCast,
  reviewed: {
    title: string;
    moral: string;
    fullText: string;
    reviewNotes: string;
  },
  opts?: PipelineOptions,
): Promise<StoryChapter[] | null> {
  const parsed = await chatJson({
    userId: opts?.userId,
    operation: "split_chapters",
    temperature: 0.4,
    system: `${STORYTELLER_SKILL}

Divida a história FINAL em ${MIN_STORY_PAGES} a ${MAX_STORY_PAGES} ATOS/páginas.
Cada ato: ~${TARGET_WORDS_PER_PAGE} palavras (±40), com começo/meio/fim de cena,
diálogos quando couber, e um image_prompt em INGLÊS para ilustração Walt Disney/Pixar 3D.

Regras do image_prompt (CRÍTICO):
- Cada ato tem batida visual ÚNICA: lugar, pose, framing e emoção diferentes.
- Ato 1 = emoção do INÍCIO da história (ex.: medo à distância), NÃO o clímax.
- Citar visualmente a criança "${opts?.protagonistName || cast.childName}" e o amigo "${cast.friendName}" (${cast.friendKind}).
- Se a cena for pública/com desconhecido: incluir pai/mãe/cuidador presente na imagem.
- Estilo: "Walt Disney / Pixar 3D animated still, cinematic soft lighting, wholesome"
- Explicit: "do not repeat previous framing; match this beat exactly"
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

Fracione agora. Garanta image_prompts distintos por ato.`,
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
        `Walt Disney / Pixar 3D animated still of child ${cast.childName} with ${cast.friendKind} ${cast.friendName}, unique beat ${chapters.length + 1}, wholesome cinematic lighting, do not repeat previous framing, no text`,
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
  options?: PipelineOptions;
}): Promise<GeneratePipelineResult> {
  const theme = input.theme.trim();
  const cast = input.cast;
  const opts = input.options;

  const draft = await draftFullStory(cast, theme, opts);
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
    (await reviewStory(cast, theme, draft, opts)) ?? {
      ...draft,
      reviewNotes: "revisão pulada — usando rascunho",
    };

  const chapters = await splitIntoChapters(cast, reviewed, opts);
  if (!chapters) {
    const words = reviewed.fullText.split(/\s+/);
    const chunks = 6;
    const size = Math.ceil(words.length / chunks);
    const fallback: StoryChapter[] = Array.from({ length: chunks }, (_, i) => {
      const text = words.slice(i * size, (i + 1) * size).join(" ");
      return {
        index: i,
        title: `Parte ${i + 1}`,
        text,
        imagePrompt: `Walt Disney / Pixar 3D animated still of ${cast.childName} and ${cast.friendName}, unique scene ${i + 1} of ${chunks}, distinct framing, wholesome, do not repeat previous framing, no text`,
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
