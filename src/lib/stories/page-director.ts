import { modelForActivity } from "@/lib/ai/model-registry";
import {
  companionSpeciesLabel,
  speciesLockPromptLine,
  type StoryCast,
} from "@/lib/stories/story-cast";
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
 * Diretor de página (Gemini Flash): 1 call barata por bloco →
 * `directed_image_prompt` cinematográfico alinhado ao texto + bible.
 */
export async function directPageImagePrompts<T extends ChapterLike>(input: {
  userId?: string | null;
  cast: StoryCast;
  title: string;
  chapters: T[];
}): Promise<T[]> {
  if (input.chapters.length === 0) return input.chapters;

  const species = companionSpeciesLabel(input.cast);
  const speciesLine = speciesLockPromptLine(input.cast);
  const previousNotes: string[] = [];
  const out: T[] = [];

  for (let i = 0; i < input.chapters.length; i++) {
    const chapter = input.chapters[i];
    const text = chapter.text.replace(/\s+/g, " ").trim().slice(0, 700);
    const bibleBits = chapter.imagePrompt.replace(/\s+/g, " ").trim().slice(0, 900);

    try {
      const result = await meteredChatCompletion({
        userId: input.userId,
        category: "story_text",
        operation: "story_page_director",
        body: {
          model: modelForActivity("story_page_director"),
          temperature: 0.35,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `You are a film director writing ONE English image prompt for a Walt Disney / Pixar 3D children's still (Gemini-quality cinematic brief).

Return ONLY JSON:
{
  "directed_image_prompt": string,
  "framing_note": string
}

Rules for directed_image_prompt:
- Depict ONLY this page's text beat (location, who is present, action, emotion, clothing cues).
- Obey wardrobe / CONTINUITY / NPC NOTES already in the bible snippet — do not invent a new outfit mid school-day.
- Companion "${input.cast.friendName}": structured lock — species MUST be ${species || "exact avatar species"}; never invent rabbit/monkey/bear if traits say otherwise.
- NPCs: distinct locked looks (not clones of the protagonist).
- Anatomy: exactly 2 arms and 2 legs for able-bodied humans; clear readable poses; no impossible joints.
- Unique composition vs previous pages (camera, pose, foreground prop).
- Style: Walt Disney / Pixar 3D animated cinematic still, soft lighting, wholesome, no text/watermark.`,
            },
            {
              role: "user",
              content: [
                `Story title: ${input.title}`,
                `Page ${i + 1}/${input.chapters.length} — "${chapter.title}"`,
                speciesLine,
                input.cast.companionVisualLock || "",
                previousNotes.length
                  ? `Avoid repeating these framings: ${previousNotes.join(" | ")}`
                  : "First page — establish a clear unique opening frame.",
                `PAGE TEXT (literal beat):\n"""${text}"""`,
                `BIBLE / PRIOR PROMPT SNIPPET:\n"""${bibleBits}"""`,
                "Write directed_image_prompt now.",
              ]
                .filter(Boolean)
                .join("\n\n"),
            },
          ],
        },
        timeoutMs: 60_000,
      });

      if (!result.ok || !result.content) {
        out.push(chapter);
        continue;
      }
      const parsed = parseJsonLoose(result.content);
      const directed = String(parsed?.directed_image_prompt ?? "").trim();
      const framing = String(parsed?.framing_note ?? "").trim();
      if (directed.length < 40) {
        out.push(chapter);
        continue;
      }
      if (framing) previousNotes.push(framing.slice(0, 80));
      else previousNotes.push(`page${i + 1}:${directed.slice(0, 60)}`);

      const merged = [
        directed,
        speciesLine,
        chapter.imagePrompt.includes("WARDROBE OUTFIT") ||
        chapter.imagePrompt.includes("CONTINUITY BEAT")
          ? `PRESERVE LOCKS FROM BIBLE: ${bibleBits.slice(0, 500)}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");

      out.push({ ...chapter, imagePrompt: merged });
    } catch {
      out.push(chapter);
    }
  }

  return out;
}
