import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type AvatarRefreshStatus = {
  /** Calculado no cliente (evita Date.now no RSC / cacheComponents). */
  due: boolean;
  childId?: string;
  childName?: string;
  dueAt?: string | null;
  capturedAt?: string | null;
};

/** Carrega timestamps — NÃO usa Date.now() (prerender-safe). */
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

  return {
    due: false, // cliente decide com dueAt
    childId: data.id,
    childName: data.display_name,
    dueAt: data.avatar_refresh_due_at,
    capturedAt: data.avatar_photos_captured_at,
  };
}
