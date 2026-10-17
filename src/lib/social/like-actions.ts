"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function toggleStoryLikeAction(
  storyId: string,
): Promise<{ error?: string; liked?: boolean; likeCount?: number }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Não autenticado." };

  const admin = createAdminClient();
  const userClient = await createClient();
  const db = admin ?? userClient;
  if (!db) return { error: "Banco indisponível." };

  const { data: existing } = await db
    .from("story_likes")
    .select("story_id")
    .eq("story_id", storyId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await db
      .from("story_likes")
      .delete()
      .eq("story_id", storyId)
      .eq("user_id", user.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await db.from("story_likes").insert({
      story_id: storyId,
      user_id: user.id,
    });
    if (error) return { error: error.message };
  }

  const { count } = await db
    .from("story_likes")
    .select("story_id", { count: "exact", head: true })
    .eq("story_id", storyId);

  revalidatePath("/app/social");
  return { liked: !existing, likeCount: count ?? 0 };
}
