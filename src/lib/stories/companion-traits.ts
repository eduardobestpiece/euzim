import { modelForActivity } from "@/lib/ai/model-registry";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  buildCompanionVisualLock,
  type StoryCast,
} from "@/lib/stories/story-cast";
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

function traitsAlreadyUseful(lock: string): boolean {
  // Se já há traços concretos além do template COMPANION LOCK, pula vision.
  return /Traços cadastrados:/i.test(lock) && lock.length > 220;
}

/**
 * Se o companheiro tem avatar mas traits vazios, extrai aparência via vision
 * (1x) e grava em characters.traits / description — alimenta histórias futuras.
 */
export async function ensureCompanionVisualTraits(input: {
  userId: string;
  cast: StoryCast;
}): Promise<StoryCast> {
  const { userId, cast } = input;
  const avatarUrl =
    cast.friendHeroUrl || cast.friendSheetUrl || null;
  if (!avatarUrl) return cast;
  if (traitsAlreadyUseful(cast.companionVisualLock)) return cast;

  const db = createAdminClient() ?? (await createClient());
  if (!db) return cast;

  let friendId: string | null = null;
  try {
    const { data: rows } = await db
      .from("characters")
      .select("id, name, traits, description, avatar_url")
      .eq("parent_id", userId)
      .ilike("name", cast.friendName)
      .limit(3);
    const friend =
      rows?.find((r) => r.name === cast.friendName) ?? rows?.[0] ?? null;
    friendId = friend?.id ?? null;
    const existingTraits = Array.isArray(friend?.traits)
      ? friend!.traits.map(String).filter(Boolean)
      : [];
    if (existingTraits.length >= 2) {
      const summary = existingTraits.join(", ");
      return {
        ...cast,
        companionVisualLock: buildCompanionVisualLock({
          friendName: cast.friendName,
          friendKind: cast.friendKind,
          friendGender: cast.friendGender,
          traitsSummary: summary,
          hasAvatar: true,
        }),
      };
    }
  } catch {
    return cast;
  }

  const result = await meteredChatCompletion({
    userId,
    category: "other",
    operation: "companion_avatar_traits",
    body: {
      model: modelForActivity("story_aux"),
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Describe the companion character in this Pixar-style avatar for children's story continuity.
Return ONLY JSON:
{
  "species_or_form": string,
  "colors": string,
  "body_shape": string,
  "face_features": string,
  "distinct_traits": string[],
  "one_line_en": string,
  "one_line_pt": string
}
Be literal about what you see. Do NOT invent a different animal.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Companion name: "${cast.friendName}". Extract locked visual traits from this avatar.`,
            },
            {
              type: "image_url",
              image_url: { url: avatarUrl },
            },
          ],
        },
      ],
    },
    timeoutMs: 60_000,
  });

  if (!result.ok || !result.content) return cast;
  const parsed = parseJsonLoose(result.content);
  if (!parsed) return cast;

  const traits = Array.isArray(parsed.distinct_traits)
    ? parsed.distinct_traits.map(String).filter(Boolean).slice(0, 8)
    : [];
  const oneLinePt = String(parsed.one_line_pt ?? "").trim();
  const oneLineEn = String(parsed.one_line_en ?? "").trim();
  const species = String(parsed.species_or_form ?? "").trim();
  const colors = String(parsed.colors ?? "").trim();
  const body = String(parsed.body_shape ?? "").trim();
  const face = String(parsed.face_features ?? "").trim();

  const traitList = [
    ...traits,
    species && `species:${species}`,
    colors && `colors:${colors}`,
    body && `body:${body}`,
    face && `face:${face}`,
  ].filter(Boolean) as string[];

  if (traitList.length === 0 && !oneLineEn && !oneLinePt) return cast;

  const summary =
    [oneLineEn || oneLinePt, traitList.join(", ")].filter(Boolean).join(" — ") ||
    traitList.join(", ");

  const description =
    oneLinePt ||
    oneLineEn ||
    `Avatar Pixar de ${cast.friendName}: seguir aparência exata (${summary}).`;

  if (friendId) {
    try {
      await db
        .from("characters")
        .update({
          traits: traitList,
          description: description.slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq("id", friendId)
        .eq("parent_id", userId);
    } catch {
      /* continua com lock em memória */
    }
  }

  return {
    ...cast,
    companionVisualLock: buildCompanionVisualLock({
      friendName: cast.friendName,
      friendKind: cast.friendKind,
      friendGender: cast.friendGender,
      traitsSummary: summary.slice(0, 280),
      hasAvatar: true,
    }),
  };
}
