import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAvatarRefreshDue } from "@/lib/onboarding/child-profile";

export type AvatarRefreshStatus = {
  due: boolean;
  childId?: string;
  childName?: string;
  dueAt?: string | null;
  capturedAt?: string | null;
};

/** Gate básico: fotos de avatar com mais de ~12 meses. */
export async function getAvatarRefreshStatus(
  parentId: string,
): Promise<AvatarRefreshStatus> {
  const db = createAdminClient() ?? (await createClient());
  if (!db) return { due: false };

  const { data } = await db
    .from("children")
    .select("id, display_name, avatar_photos_captured_at, avatar_refresh_due_at")
    .eq("parent_id", parentId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!data) return { due: false };

  // Agora explícito (cacheComponents / connection()) em vez do default new Date()
  const due = isAvatarRefreshDue(data.avatar_refresh_due_at, new Date());
  return {
    due,
    childId: data.id,
    childName: data.display_name,
    dueAt: data.avatar_refresh_due_at,
    capturedAt: data.avatar_photos_captured_at,
  };
}
