/**
 * Catálogo central: atividade de IA → modelo OpenRouter.
 * Critério: qualidade primeiro; custo segundo (evitar pagar caro sem necessidade).
 * Inclui DeepSeek (CN) quando o equilíbrio qualidade/preço é melhor que Claude/GPT.
 */

export type AiActivity =
  | "story_text"
  | "story_aux"
  | "story_quiz"
  | "story_clarify"
  | "story_continuity"
  | "story_page_director"
  | "avatar_pixar"
  | "story_image"
  | "avatar_preview"
  | "other";

export type AiModelSpec = {
  /** Slug OpenRouter (ex. openai/gpt-4o). */
  model: string;
  /** Motivo curto do default (Admin / docs). */
  rationale: string;
};

/**
 * Defaults (OpenRouter) — qualidade prioritária, custo consciente:
 * - História: DeepSeek V4 Pro (~qualidade Claude/GPT a fração do preço; JSON limpo).
 * - Aux/quiz/clarify: Gemini 2.5 Flash (barato, JSON estável no pipeline).
 * - Imagem/Pixar: GPT Image 2 (fidelidade das refs — não trocar por barato).
 */
const DEFAULTS: Record<AiActivity, AiModelSpec> = {
  story_text: {
    model: "deepseek/deepseek-v4-pro",
    rationale:
      "Narrativa longa PT-BR: qualidade top-tier com ~10× menos $/1M que Claude Sonnet",
  },
  story_aux: {
    model: "google/gemini-2.5-flash",
    rationale: "Outline/split barato e JSON estável",
  },
  story_quiz: {
    model: "google/gemini-2.5-flash",
    rationale: "Quiz estruturado / JSON barato",
  },
  story_clarify: {
    model: "google/gemini-2.5-flash",
    rationale: "Clarify rápido antes do enqueue",
  },
  story_continuity: {
    model: "google/gemini-2.5-flash",
    rationale: "Bíblia de continuidade de cenas",
  },
  story_page_director: {
    model: "google/gemini-2.5-flash",
    rationale:
      "Diretor de página: prompt cinematográfico Gemini por bloco (barato)",
  },
  avatar_pixar: {
    model: "openai/gpt-image-2",
    rationale: "Fidelidade Pixar com referências (Image API)",
  },
  story_image: {
    model: "openai/gpt-image-2",
    rationale: "Ilustrações de página com refs de avatar",
  },
  avatar_preview: {
    model: "openai/gpt-image-2",
    rationale: "Preview leve de avatar",
  },
  other: {
    model: "google/gemini-2.5-flash",
    rationale: "Fallback utilitário",
  },
};

function envOverride(activity: AiActivity): string | undefined {
  switch (activity) {
    case "story_text":
      return (
        process.env.OPENROUTER_STORY_MODEL?.trim() ||
        process.env.AI_STORY_MODEL?.trim() ||
        process.env.OPENAI_STORY_MODEL?.trim()
      );
    case "story_page_director":
      return (
        process.env.OPENROUTER_STORY_PAGE_DIRECTOR_MODEL?.trim() ||
        process.env.OPENROUTER_STORY_AUX_MODEL?.trim() ||
        process.env.AI_STORY_AUX_MODEL?.trim()
      );
    case "story_aux":
    case "story_quiz":
    case "story_clarify":
    case "story_continuity":
      return (
        process.env.OPENROUTER_STORY_AUX_MODEL?.trim() ||
        process.env.AI_STORY_AUX_MODEL?.trim() ||
        process.env.OPENAI_STORY_AUX_MODEL?.trim()
      );
    case "avatar_pixar":
    case "story_image":
    case "avatar_preview":
      return (
        process.env.OPENROUTER_IMAGE_MODEL?.trim() ||
        process.env.AI_IMAGE_MODEL?.trim() ||
        process.env.OPENAI_IMAGE_MODEL?.trim()
      );
    case "other":
      return process.env.OPENROUTER_DEFAULT_MODEL?.trim();
    default: {
      const _exhaustive: never = activity;
      return _exhaustive;
    }
  }
}

/** Garante slug com provider/ (OpenRouter). */
export function toOpenRouterModelId(model: string): string {
  const m = model.trim();
  if (!m) return DEFAULTS.other.model;
  if (m.includes("/")) return m;
  if (m.startsWith("gpt-image") || m.startsWith("dall-e")) {
    return `openai/${m}`;
  }
  if (m.startsWith("gpt-") || m.startsWith("o1") || m.startsWith("o3")) {
    return `openai/${m}`;
  }
  if (m.startsWith("claude")) return `anthropic/${m}`;
  if (m.startsWith("gemini")) return `google/${m}`;
  if (m.startsWith("deepseek")) return `deepseek/${m}`;
  return m;
}

/** Modelo efetivo para a atividade (env > default). */
export function modelForActivity(activity: AiActivity): string {
  const fromEnv = envOverride(activity);
  if (fromEnv) return toOpenRouterModelId(fromEnv);
  return DEFAULTS[activity].model;
}

export function modelSpecForActivity(activity: AiActivity): AiModelSpec {
  const model = modelForActivity(activity);
  const base = DEFAULTS[activity];
  return { model, rationale: base.rationale };
}

export function listActivityModels(): Array<{
  activity: AiActivity;
  model: string;
  rationale: string;
}> {
  return (Object.keys(DEFAULTS) as AiActivity[]).map((activity) => ({
    activity,
    ...modelSpecForActivity(activity),
  }));
}

export { DEFAULTS as AI_ACTIVITY_DEFAULTS };
