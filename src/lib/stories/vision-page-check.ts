import { modelForActivity } from "@/lib/ai/model-registry";
import { meteredChatCompletion } from "@/lib/usage/openai-meter";

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

export type VisionPageCheckResult = {
  ok: boolean;
  score: number;
  issues: string[];
  fixHint: string;
};

/**
 * Vision check: a imagem gerada bate com o texto da página?
 * Usado na regeneração (e opcionalmente em retries).
 */
export async function visionCheckStoryPage(input: {
  userId?: string | null;
  pageText: string;
  imageUrl: string;
  companionName: string;
  companionLock?: string;
}): Promise<VisionPageCheckResult> {
  const fallback: VisionPageCheckResult = {
    ok: true,
    score: 1,
    issues: [],
    fixHint: "",
  };
  if (!input.imageUrl || input.imageUrl.startsWith("data:")) {
    // data URLs podem estourar token — pula check
    return fallback;
  }

  const result = await meteredChatCompletion({
    userId: input.userId,
    category: "other",
    operation: "vision_page_align",
    body: {
      model: modelForActivity("story_aux"),
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You judge if a children's story illustration matches the page text AND has coherent anatomy.
Return ONLY JSON:
{
  "ok": boolean,
  "score": number,
  "issues": string[],
  "fix_hint_en": string
}
ok=false if:
- location/people/action clearly contradict the text (e.g. bedroom text but playground image; boy present when text says he is alone across the yard)
- companion looks like a different species than the named companion avatar should (e.g. rabbit instead of dog plush)
- anatomy errors: 3+ arms/hands/legs, duplicated limbs, impossible arm bends, hand facing wrong way while holding another hand
- wardrobe chaos mid school-day is optional to flag if obvious (totally different outfit vs prior description in text)
Exception: disability/wheelchair/limb-difference avatars may differ — do not flag those as errors.
score 0..1.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                `Companion name: "${input.companionName}"`,
                input.companionLock || "",
                `PAGE TEXT:"""${input.pageText.slice(0, 700)}"""`,
                "Does the image match this page?",
              ]
                .filter(Boolean)
                .join("\n"),
            },
            {
              type: "image_url",
              image_url: { url: input.imageUrl },
            },
          ],
        },
      ],
    },
    timeoutMs: 60_000,
  });

  if (!result.ok || !result.content) return fallback;
  const parsed = parseJsonLoose(result.content);
  if (!parsed) return fallback;

  const issues = Array.isArray(parsed.issues)
    ? parsed.issues.map(String).filter(Boolean).slice(0, 6)
    : [];
  const score = Number(parsed.score);
  const ok =
    parsed.ok !== false &&
    (Number.isFinite(score) ? score >= 0.55 : issues.length === 0);

  return {
    ok,
    score: Number.isFinite(score) ? score : ok ? 0.8 : 0.3,
    issues,
    fixHint: String(parsed.fix_hint_en ?? issues.join("; ")).slice(0, 500),
  };
}
