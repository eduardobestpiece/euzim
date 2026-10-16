import type { OnboardingPhotoDraft, OnboardingState } from "@/lib/auth/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { PHOTO_SLOTS } from "@/lib/onboarding/photo-slots";

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

  if (resetMode !== "reuse") {
    return { resetMode, initialState: null };
  }

  const { data: children } = await db
    .from("children")
    .select("id, display_name, avatar_url, preferences")
    .eq("parent_id", userId)
    .order("created_at", { ascending: true })
    .limit(1);

  const child = children?.[0];
  const prefs = (child?.preferences ?? {}) as {
    age_years?: number;
    photo_paths?: { slotId?: string; path?: string; url?: string }[];
  };

  const childPhotos: OnboardingPhotoDraft[] = [];
  for (const slot of PHOTO_SLOTS) {
    const found = prefs.photo_paths?.find((p) => p.slotId === slot.id);
    if (found?.url || found?.path) {
      childPhotos.push({
        id: crypto.randomUUID(),
        slotId: slot.id,
        name: slot.id,
        previewUrl: found.url || "",
        storagePath: found.path || "",
        publicUrl: found.url,
      });
    }
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
          ageYears: prefs.age_years,
        }
      : null,
    childPhotos,
    friend: friend
      ? { kind: friendKind, displayName: friend.name }
      : null,
    friendPhotos: [],
    childAvatarUrl: child?.avatar_url || primary?.avatar_url || null,
    friendAvatarUrl: friend?.avatar_url || null,
    completed: false,
  };

  return { resetMode: "reuse", initialState: state };
}
