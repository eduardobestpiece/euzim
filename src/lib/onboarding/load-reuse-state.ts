import type { OnboardingPhotoDraft, OnboardingState } from "@/lib/auth/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  CHILD_PHOTO_SLOTS,
  FRIEND_PHOTO_SLOTS,
} from "@/lib/onboarding/photo-slots";
import { draftsFromStoredPaths } from "@/lib/onboarding/photo-persistence";
import { isPixarGeneratedUrl } from "@/lib/onboarding/pixar-url";

export type ReuseBootstrap = {
  resetMode: "full" | "reuse" | null;
  initialState: OnboardingState | null;
};

/** Carrega materiais existentes quando onboarding_reset_mode=reuse. */
export async function loadOnboardingBootstrap(
  userId: string,
): Promise<ReuseBootstrap> {
  const db = createAdminClient() ?? (await createClient());
  if (!db) return { resetMode: null, initialState: null };

  const { data: profile } = await db
    .from("users")
    .select("onboarding_reset_mode, security_pin")
    .eq("id", userId)
    .maybeSingle();

  const resetMode =
    profile?.onboarding_reset_mode === "reuse" ||
    profile?.onboarding_reset_mode === "full"
      ? profile.onboarding_reset_mode
      : null;

  const { data: children } = await db
    .from("children")
    .select("id, display_name, avatar_url, birth_date, gender, preferences")
    .eq("parent_id", userId)
    .order("created_at", { ascending: true })
    .limit(1);

  const child = children?.[0];
  const prefs = (child?.preferences ?? {}) as {
    age_years?: number;
    photo_paths?: { slotId?: string; path?: string; url?: string }[];
    friend_photo_paths?: { slotId?: string; path?: string; url?: string }[];
    friend?: { kind?: string; displayName?: string };
    onboarding_wizard_step?: string;
    pixar?: {
      child_hero?: string;
      friend_hero?: string;
      child_face_sheet?: string;
      child_body_sheet?: string;
      friend_sheet?: string;
    };
  };

  const childAvatarUrl = isPixarGeneratedUrl(prefs.pixar?.child_hero)
    ? prefs.pixar!.child_hero!
    : isPixarGeneratedUrl(child?.avatar_url)
      ? child!.avatar_url!
      : null;
  const savedStep =
    typeof prefs.onboarding_wizard_step === "string"
      ? prefs.onboarding_wizard_step
      : null;

  const gender =
    child?.gender === "boy" || child?.gender === "girl" || child?.gender === "other"
      ? child.gender
      : ("other" as const);

  const childPhotos: OnboardingPhotoDraft[] = draftsFromStoredPaths(
    prefs.photo_paths,
  ).filter((p) => CHILD_PHOTO_SLOTS.some((s) => s.id === p.slotId));

  const friendPhotos: OnboardingPhotoDraft[] = draftsFromStoredPaths(
    prefs.friend_photo_paths,
  ).filter((p) => FRIEND_PHOTO_SLOTS.some((s) => s.id === p.slotId));

  const friendFromPrefs =
    prefs.friend?.displayName
      ? {
          kind:
            prefs.friend.kind === "toy"
              ? ("toy" as const)
              : ("pet" as const),
          displayName: prefs.friend.displayName,
        }
      : null;

  if (resetMode !== "reuse") {
    if (!savedStep && !child) return { resetMode, initialState: null };
    return {
      resetMode,
      initialState: {
        securityPin: profile?.security_pin || "",
        child: child
          ? {
              displayName: child.display_name,
              birthDate: child.birth_date || "",
              gender,
              ageYears: prefs.age_years,
            }
          : null,
        childPhotos,
        friend: friendFromPrefs,
        friendPhotos,
        childAvatarUrl,
        friendAvatarUrl: isPixarGeneratedUrl(prefs.pixar?.friend_hero)
          ? prefs.pixar!.friend_hero!
          : null,
        wizardStep: savedStep,
        completed: false,
      },
    };
  }

  const { data: characters } = await db
    .from("characters")
    .select("name, avatar_url, is_primary, description")
    .eq("parent_id", userId)
    .order("created_at", { ascending: true });

  const primary = characters?.find((c) => c.is_primary) ?? characters?.[0];
  const friend = characters?.find((c) => !c.is_primary);
  const friendKind =
    friend?.description?.includes("toy") || friend?.description?.includes("brinquedo")
      ? ("toy" as const)
      : ("pet" as const);

  const state: OnboardingState = {
    securityPin: profile?.security_pin || "",
    child: child
      ? {
          displayName: child.display_name,
          birthDate: child.birth_date || "",
          gender,
          ageYears: prefs.age_years,
        }
      : null,
    childPhotos,
    friend: friend
      ? { kind: friendKind, displayName: friend.name }
      : friendFromPrefs,
    friendPhotos,
    childAvatarUrl:
      childAvatarUrl ||
      (isPixarGeneratedUrl(primary?.avatar_url) ? primary!.avatar_url! : null),
    friendAvatarUrl: isPixarGeneratedUrl(prefs.pixar?.friend_hero)
      ? prefs.pixar!.friend_hero!
      : isPixarGeneratedUrl(friend?.avatar_url)
        ? friend!.avatar_url!
        : null,
    wizardStep: savedStep,
    completed: false,
  };

  return { resetMode: "reuse", initialState: state };
}
