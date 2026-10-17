import type { GeneratedPage, GeneratedStory } from "@/lib/stories/generate-mock";
import { generateMockStory } from "@/lib/stories/generate-mock";
import type { StoryCast } from "@/lib/stories/story-cast";
import {
  applyBibleToChapters,
  buildSceneContinuityBible,
} from "@/lib/stories/scene-continuity-bible";
import {
  findMatchingTemplate,
  personalizeSkeleton,
  saveStoryTemplate,
} from "@/lib/stories/story-templates";
import {
  LANGUAGE_LEVELS,
  MAX_STORY_PAGES,
  MIN_STORY_PAGES,
  PREFERRED_STORY_PAGES,
  STORYTELLER_SKILL,
  STORY_AUX_MODEL,
  STORY_TEXT_MODEL,
  TARGET_WORDS_PER_PAGE,
  languageLevelGuidance,
  storyTypeGuidance,
  type LanguageLevel,
  type StoryType,
  type WordVolume,
  WORD_VOLUME_TARGETS,
} from "@/lib/stories/storyteller-skill";
import { meteredChatCompletion } from "@/lib/usage/openai-meter";

export type StoryEngine =
  | "openai-storyteller-v1"
  | "openai-storyteller-template"
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
  templateId?: string | null;
  fromTemplate?: boolean;
};

export type PipelineOptions = {
  userId?: string | null;
  storyType?: StoryType;
  wordTarget?: number;
  wordVolume?: WordVolume;
  languageLevel?: LanguageLevel;
  clarifyAnswers?: Record<string, string>;
  castNames?: string[];
  protagonistName?: string;
};

async function chatJson(input: {
  userId?: string | null;
  operation: string;
  model: string;
  category?: "story_text" | "other";
  system: string;
  user: string;
  temperature?: number;
  timeoutMs?: number;
}): Promise<Record<string, unknown> | null> {
  const result = await meteredChatCompletion({
    userId: input.userId,
    category: input.category ?? "story_text",
    operation: input.operation,
    body: {
      model: input.model,
      temperature: input.temperature ?? 0.75,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.user },
      ],
    },
    timeoutMs: input.timeoutMs ?? 180_000,
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

function languageBrief(opts?: PipelineOptions): string {
  const level = opts?.languageLevel;
  if (!level || !(LANGUAGE_LEVELS as readonly string[]).includes(level)) {
    return "";
  }
  return `languageLevel: ${level}. ${languageLevelGuidance(level)}`;
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

/** Outline estrutural barato (mini). */
async function outlineStory(
  cast: StoryCast,
  theme: string,
  opts?: PipelineOptions,
): Promise<{
  title: string;
  moral: string;
  beats: string[];
} | null> {
  const parsed = await chatJson({
    userId: opts?.userId,
    model: STORY_AUX_MODEL,
    operation: "outline_story",
    temperature: 0.6,
    system: `${STORYTELLER_SKILL}

Você faz só o OUTLINE (esqueleto), não a prosa final.
Responda SOMENTE JSON:
{
  "title": string,
  "moral": string,
  "beats": string[] (6 a 10 batidas: lugar + conflito + emoção, 1 frase cada)
}`,
    user: `${castBrief(cast, opts)}

${typeBrief(opts)}
${languageBrief(opts)}
${clarifyBrief(opts)}

Tema: """${theme}"""

Outline agora — prefira ~${PREFERRED_STORY_PAGES} batidas (range ${MIN_STORY_PAGES}–${MAX_STORY_PAGES}).`,
    timeoutMs: 90_000,
  });
  if (!parsed) return null;
  const title = String(parsed.title ?? "").trim();
  const moral = String(parsed.moral ?? "").trim();
  const beats = Array.isArray(parsed.beats)
    ? parsed.beats.map((b) => String(b).trim()).filter(Boolean)
    : [];
  if (!title || beats.length < 5) return null;
  return { title, moral, beats };
}

/** Expansão narrativa final (modelo forte) — qualidade preservada. */
async function expandNarrative(
  cast: StoryCast,
  theme: string,
  outline: { title: string; moral: string; beats: string[] },
  opts?: PipelineOptions,
): Promise<{ title: string; moral: string; fullText: string } | null> {
  const vol = volumeBrief(opts);
  const parsed = await chatJson({
    userId: opts?.userId,
    model: STORY_TEXT_MODEL,
    operation: "expand_story",
    temperature: 0.85,
    system: `${STORYTELLER_SKILL}

Expanda o outline numa história COMPLETA, oral e cinematográfica.
Responda SOMENTE JSON:
{
  "title": string,
  "moral": string,
  "full_text": string (OBRIGATÓRIO ${vol.min}–${vol.max} palavras)
}`,
    user: `${castBrief(cast, opts)}

${typeBrief(opts)}
${languageBrief(opts)}
${clarifyBrief(opts)}

Tema: """${theme}"""
Título outline: ${outline.title}
Moral: ${outline.moral}
Batidas:
${outline.beats.map((b, i) => `${i + 1}. ${b}`).join("\n")}

Escreva a prosa final completa (~${vol.target} palavras).
Não invente detalhes visuais que contradigam o avatar da criança.`,
  });
  if (!parsed) return null;
  const title = String(parsed.title ?? outline.title).trim();
  const moral = String(parsed.moral ?? outline.moral).trim();
  const fullText = String(parsed.full_text ?? "").trim();
  const minWords = Math.min(700, Math.round(vol.min * 0.7));
  if (!title || fullText.split(/\s+/).length < minWords) return null;
  return { title, moral, fullText };
}

/** Revisão leve (mini) — só ajusta se necessário. */
async function lightReview(
  cast: StoryCast,
  theme: string,
  draft: { title: string; moral: string; fullText: string },
  opts?: PipelineOptions,
): Promise<{
  title: string;
  moral: string;
  fullText: string;
  reviewNotes: string;
}> {
  const parsed = await chatJson({
    userId: opts?.userId,
    model: STORY_AUX_MODEL,
    operation: "light_review",
    temperature: 0.35,
    system: `${STORYTELLER_SKILL}

EDITOR LEVE: corrija só problemas graves (protagonistas, segurança parental,
adequação etária). Se estiver boa, devolva o texto quase igual.
Responda SOMENTE JSON:
{
  "title": string,
  "moral": string,
  "full_text": string,
  "review_notes": string
}`,
    user: `${castBrief(cast, opts)}
Tema: """${theme}"""
Título: ${draft.title}
Moral: ${draft.moral}
TEXTO:
"""
${draft.fullText}
"""`,
    timeoutMs: 120_000,
  });
  if (!parsed) {
    return { ...draft, reviewNotes: "revisão leve pulada" };
  }
  const fullText = String(parsed.full_text ?? "").trim();
  if (fullText.split(/\s+/).length < 400) {
    return { ...draft, reviewNotes: "revisão leve descartada — texto curto" };
  }
  return {
    title: String(parsed.title ?? draft.title).trim(),
    moral: String(parsed.moral ?? draft.moral).trim(),
    fullText,
    reviewNotes: String(parsed.review_notes ?? "revisão leve").trim(),
  };
}

/** Split em atos (mini). */
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
    model: STORY_AUX_MODEL,
    operation: "split_chapters",
    temperature: 0.4,
    system: `${STORYTELLER_SKILL}

Divida a história FINAL em ${MIN_STORY_PAGES} a ${MAX_STORY_PAGES} ATOS/páginas
(alvo preferido: ${PREFERRED_STORY_PAGES} atos — um beat = uma imagem).
Cada ato: ~${TARGET_WORDS_PER_PAGE} palavras (±40), com começo/meio/fim de cena,
diálogos quando couber, e um image_prompt em INGLÊS para ilustração Walt Disney/Pixar 3D.

Regras do image_prompt (CRÍTICO):
- Cada ato tem batida visual ÚNICA: lugar, pose, framing/câmera e emoção diferentes.
- Atribua a cada ato um ângulo distinto (wide / medium two-shot / over-shoulder /
  close-up emotion / low-angle / high-angle / side-profile / seated conversation).
- NUNCA repita o mesmo close-up da criança abraçando o amigo.
- Ato 1 = emoção do INÍCIO da história (ex.: medo à distância), NÃO o clímax.
- Citar visualmente a criança "${opts?.protagonistName || cast.childName}" e o amigo "${cast.friendName}" (${cast.friendKind}).
- Se a cena for pública/com desconhecido: incluir pai/mãe/cuidador presente na imagem.
- Pais/irmãos SEM avatar na plataforma: body-only (de costas / rosto oculto) — nunca inventar rosto.
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
    timeoutMs: 120_000,
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
 * Pipeline custo-otimizado:
 * template hit → personaliza; senão outline(mini) → expand(forte) → review(mini) → split(mini).
 */
export async function generateStoryPipeline(input: {
  cast: StoryCast;
  theme: string;
  options?: PipelineOptions;
}): Promise<GeneratePipelineResult> {
  const theme = input.theme.trim();
  const cast = input.cast;
  const opts = input.options;
  const childName = opts?.protagonistName?.trim() || cast.childName;
  const friendName = cast.friendName;

  // 1) Cache de template
  const matched = await findMatchingTemplate({
    theme,
    userId: opts?.userId,
  });
  if (matched && matched.score >= 0.45) {
    const personalized = personalizeSkeleton(
      matched.skeleton,
      childName,
      friendName,
      matched.title,
    );
    const chapters: StoryChapter[] = personalized.pages.map((p) => ({
      index: p.index,
      title: p.title,
      text: p.text,
      imagePrompt:
        p.imagePrompt ||
        `Walt Disney / Pixar 3D still of ${childName} and ${friendName}, beat ${p.index + 1}, unique framing, no text`,
    }));
    if (chapters.length >= MIN_STORY_PAGES) {
      return packResult(
        {
          title: personalized.title,
          moral: personalized.moral,
          fullText: personalized.fullText,
          reviewNotes: `template cache hit (score ${matched.score.toFixed(2)})`,
          templateId: matched.id,
          fromTemplate: true,
        },
        chapters.slice(0, MAX_STORY_PAGES),
        "openai-storyteller-template",
      );
    }
  }

  // 2) Outline (mini) → expand (forte) → light review (mini) → split (mini)
  const outline = await outlineStory(cast, theme, opts);
  if (!outline) {
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

  const expanded = await expandNarrative(cast, theme, outline, opts);
  if (!expanded) {
    return {
      story: generateMockStory({
        childName: cast.childName,
        friendName: cast.friendName,
        theme,
      }),
      pipeline: {
        title: outline.title,
        moral: outline.moral,
        pages: [],
        fullText: "",
        reviewNotes: "expand failed",
      },
      engine: "mock-v1",
    };
  }

  const reviewed = await lightReview(cast, theme, expanded, opts);

  const chapters = await splitIntoChapters(cast, reviewed, opts);
  let finalChapters =
    chapters ??
    (() => {
      const words = reviewed.fullText.split(/\s+/);
      const chunks = PREFERRED_STORY_PAGES;
      const size = Math.ceil(words.length / chunks);
      return Array.from({ length: chunks }, (_, i) => {
        const text = words.slice(i * size, (i + 1) * size).join(" ");
        return {
          index: i,
          title: `Parte ${i + 1}`,
          text,
          imagePrompt: `Walt Disney / Pixar 3D animated still of ${cast.childName} and ${cast.friendName}, unique scene ${i + 1} of ${chunks}, distinct framing, wholesome, do not repeat previous framing, no text`,
        } satisfies StoryChapter;
      });
    })();

  // Scene Continuity Bible → injeta props/expressões nos image_prompts
  const bible = await buildSceneContinuityBible({
    userId: opts?.userId,
    cast,
    title: reviewed.title,
    chapters: finalChapters,
  });
  finalChapters = applyBibleToChapters(finalChapters, bible);

  // 3) Salvar template anonimizado (inédito)
  let templateId: string | null = null;
  if (opts?.userId) {
    templateId = await saveStoryTemplate({
      userId: opts.userId,
      theme,
      title: reviewed.title,
      moral: reviewed.moral,
      fullText: reviewed.fullText,
      pages: finalChapters,
      childName,
      friendName,
      storyType: opts.storyType,
    });
  }

  return packResult(
    {
      ...reviewed,
      templateId,
      fromTemplate: false,
    },
    finalChapters,
    "openai-storyteller-v1",
  );
}

function packResult(
  reviewed: {
    title: string;
    moral: string;
    fullText: string;
    reviewNotes: string;
    templateId?: string | null;
    fromTemplate?: boolean;
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
        templateId: reviewed.templateId ?? null,
        fromTemplate: Boolean(reviewed.fromTemplate),
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
      templateId: reviewed.templateId ?? null,
      fromTemplate: Boolean(reviewed.fromTemplate),
    },
    engine,
  };
}
