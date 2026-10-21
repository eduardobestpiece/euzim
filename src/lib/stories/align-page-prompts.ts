import { modelForActivity } from "@/lib/ai/model-registry";
import type { StoryCast } from "@/lib/stories/story-cast";
import { meteredChatCompletion } from "@/lib/usage/openai-meter";

type ChapterLike = {
  index: number;
  title: string;
  text: string;
  imagePrompt: string;
};

function parseJsonLoose(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    /* continue */
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim()) as Record<string, unknown>;
    } catch {
      /* continue */
    }
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1)) as Record<
        string,
        unknown
      >;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Check barato pós-split: reescreve image_prompts que não batem com o texto do ato.
 * Uma chamada em lote (modelo aux).
 */
export async function realignChaptersToPageText<T extends ChapterLike>(input: {
  userId?: string | null;
  cast: StoryCast;
  chapters: T[];
}): Promise<T[]> {
  if (input.chapters.length === 0) return input.chapters;

  const digest = input.chapters
    .map((c, i) => {
      const text = c.text.replace(/\s+/g, " ").trim().slice(0, 500);
      const prompt = c.imagePrompt.replace(/\s+/g, " ").trim().slice(0, 500);
      return `### PAGE ${i}\nTEXT: ${text}\nPROMPT: ${prompt}`;
    })
    .join("\n\n");

  const result = await meteredChatCompletion({
    userId: input.userId,
    category: "story_text",
    operation: "align_page_prompts",
    body: {
      model: modelForActivity("story_aux"),
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You align children's story image prompts to their page text.
For EACH page, decide if the image_prompt matches the page text (same place, people present, action, clothing cues).
If mismatched, rewrite image_prompt_en to depict ONLY that page's text.
Keep Walt Disney/Pixar 3D still style. Companion "${input.cast.friendName}" must match the avatar (never invent a different species like a rabbit).
NPCs keep a FIXED unique look across pages. Environment scale stays stable.
Anatomy: prefer clear poses; exactly 2 arms/2 legs for able-bodied characters; no impossible back-view arm hugs.
Return ONLY JSON:
{
  "pages": [
    {
      "index": 0,
      "aligned": boolean,
      "image_prompt_en": string,
      "issue": string|null
    }
  ]
}`,
        },
        {
          role: "user",
          content: `${input.cast.companionVisualLock || ""}

PAGES:
${digest}

Align now.`,
        },
      ],
    },
    timeoutMs: 90_000,
  });

  if (!result.ok || !result.content) return input.chapters;
  const parsed = parseJsonLoose(result.content);
  if (!parsed) return input.chapters;
  const rows = Array.isArray(parsed.pages) ? parsed.pages : [];
  if (rows.length === 0) return input.chapters;

  return input.chapters.map((chapter, i) => {
    const row = rows.find((r) => {
      if (!r || typeof r !== "object") return false;
      return Number((r as Record<string, unknown>).index) === i;
    }) as Record<string, unknown> | undefined;
    if (!row) return chapter;
    const nextPrompt = String(row.image_prompt_en ?? "").trim();
    if (nextPrompt.length < 40) return chapter;
    const aligned = row.aligned !== false;
    if (aligned && nextPrompt === chapter.imagePrompt) return chapter;
    return { ...chapter, imagePrompt: nextPrompt };
  });
}
