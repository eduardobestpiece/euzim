import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type AvatarRefreshStatus = {
  due: boolean;
  childId?: string;
  childName?: string;
  dueAt?: string | null;
  capturedAt?: string | null;
};

/**
 * Gate: fotos de avatar com mais de ~12 meses.
 * `nowMs` deve vir da page DEPOIS de `await connection()` — evita Date.now()
 * dentro deste módulo (cacheComponents / prerender).
 */
export async function getAvatarRefreshStatus(
  parentId: string,
  nowMs: number,
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

  const dueAt = data.avatar_refresh_due_at as string | null;
  const dueMs = dueAt ? Date.parse(dueAt) : NaN;
  const due = Number.isFinite(dueMs) && dueMs <= nowMs;

  return {
    due,
    childId: data.id,
    childName: data.display_name,
    dueAt: data.avatar_refresh_due_at,
    capturedAt: data.avatar_photos_captured_at,
  };
}
