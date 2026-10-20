/**
 * Compat: gera texto da história via pipeline Contador Sábio.
 * Preferir `generateStoryPipeline` + `generateStoryPageImages` no action/API.
 */
import type { GeneratedStory } from "@/lib/stories/generate-mock";
import { generateStoryPipeline } from "@/lib/stories/generate-pipeline";
import {
  buildCompanionVisualLock,
  type StoryCast,
} from "@/lib/stories/story-cast";
import type { StoryEngine } from "@/lib/stories/generate-pipeline";

export type GenerateStoryTextResult = {
  story: GeneratedStory;
  engine: StoryEngine;
};

export async function generateStoryText(input: {
  childName: string;
  theme: string;
  cast?: StoryCast | null;
}): Promise<GenerateStoryTextResult> {
  const cast: StoryCast = input.cast ?? {
    childId: "anon",
    childName: input.childName,
    childAgeYears: null,
    childGender: null,
    friendName: "Amigo",
    friendKind: "pet",
    friendGender: "unknown",
    companionVisualLock: buildCompanionVisualLock({
      friendName: "Amigo",
      friendKind: "pet",
      friendGender: "unknown",
      hasAvatar: false,
    }),
    childHeroUrl: null,
    friendHeroUrl: null,
    childFaceSheetUrl: null,
    childBodySheetUrl: null,
    friendSheetUrl: null,
    characterId: null,
    hasFamilyMemberAvatars: false,
  };

  const result = await generateStoryPipeline({
    cast,
    theme: input.theme,
  });
  return { story: result.story, engine: result.engine };
}
