import { createAdminClient } from "@/lib/supabase/admin";
import { readMockOnboarding } from "@/lib/auth/mock-session";
import type { AuthUser } from "@/lib/auth/types";

export type ChildContext = {
  childId: string;
  childName: string;
  characterId?: string;
};

/**
 * Garante public.users + children (+ character opcional) via admin.
 * Usa dados do onboarding mock quando a criança ainda não está no banco.
 */
export async function ensureParentChildContext(
  user: AuthUser,
): Promise<ChildContext | null> {
  const admin = createAdminClient();
  if (!admin) return null;

  const onboarding = await readMockOnboarding();

  await admin.from("users").upsert(
    {
      id: user.id,
      email: user.email,
      full_name: user.fullName ?? onboarding?.child?.displayName ?? null,
      role: user.role,
      onboarding_completed: true,
      security_pin: onboarding?.securityPin || null,
    },
    { onConflict: "id" },
  );

  const { data: existingChildren } = await admin
    .from("children")
    .select("id, display_name")
    .eq("parent_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);

  let childId = existingChildren?.[0]?.id as string | undefined;
  let childName = existingChildren?.[0]?.display_name as string | undefined;

  if (!childId) {
    const name = onboarding?.child?.displayName?.trim();
    if (!name || !onboarding) return null;

    const photos = onboarding.photos ?? [];
    const { data: created, error } = await admin
      .from("children")
      .insert({
        parent_id: user.id,
        display_name: name,
        birth_date: onboarding.child?.birthDate || null,
        avatar_url: photos[0]?.previewUrl || null,
        avatar_model_id: photos.length ? `lora-pending:${user.id}` : null,
        preferences: {
          lora_training: photos.length ? "simulated" : undefined,
          photo_paths: photos.map((p) => p.storagePath),
        },
      })
      .select("id, display_name")
      .single();

    if (error || !created) return null;
    childId = created.id;
    childName = created.display_name;
  }

  const { data: characters } = await admin
    .from("characters")
    .select("id")
    .eq("parent_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);

  let characterId = characters?.[0]?.id as string | undefined;

  if (!characterId && childName) {
    const { data: createdChar } = await admin
      .from("characters")
      .insert({
        parent_id: user.id,
        child_id: childId,
        name: childName,
        is_primary: true,
        description: "Personagem principal da criança",
      })
      .select("id")
      .maybeSingle();
    characterId = createdChar?.id;
  }

  return {
    childId: childId!,
    childName: childName!,
    characterId,
  };
}
