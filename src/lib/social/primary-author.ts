import type { SupabaseClient } from "@supabase/supabase-js";

export type PrimaryAuthor = {
  name: string;
  avatarUrl: string | null;
};

/** Autor do feed = criança protagonista (is_primary) ou primeiro filho. */
export async function loadPrimaryAuthors(
  db: SupabaseClient,
  parentIds: string[],
): Promise<Map<string, PrimaryAuthor>> {
  const map = new Map<string, PrimaryAuthor>();
  const unique = [...new Set(parentIds.filter(Boolean))];
  if (unique.length === 0) return map;

  const { data: chars } = await db
    .from("characters")
    .select("parent_id, name, avatar_url, is_primary")
    .in("parent_id", unique)
    .eq("is_primary", true);

  for (const c of chars ?? []) {
    if (!c.parent_id || map.has(c.parent_id)) continue;
    map.set(c.parent_id, {
      name: c.name || "Amigo",
      avatarUrl: c.avatar_url ?? null,
    });
  }

  const missing = unique.filter((id) => !map.has(id));
  if (missing.length > 0) {
    const { data: children } = await db
      .from("children")
      .select("parent_id, display_name, avatar_url")
      .in("parent_id", missing)
      .order("created_at", { ascending: true });

    for (const child of children ?? []) {
      if (!child.parent_id || map.has(child.parent_id)) continue;
      map.set(child.parent_id, {
        name: child.display_name || "Amigo",
        avatarUrl: child.avatar_url ?? null,
      });
    }
  }

  for (const id of unique) {
    if (!map.has(id)) {
      map.set(id, { name: "Amigo", avatarUrl: null });
    }
  }

  return map;
}
