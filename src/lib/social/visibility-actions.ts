"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { StoryVisibility } from "@/lib/social/types";

export async function updateStoryVisibilityAction(
  storyId: string,
  visibility: StoryVisibility,
): Promise<{ error?: string; success?: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Não autenticado." };

  if (
    visibility !== "private" &&
    visibility !== "friends" &&
    visibility !== "public"
  ) {
    return { error: "Visibilidade inválida." };
  }

  const db = createAdminClient() ?? (await createClient());
  if (!db) return { error: "Banco indisponível." };

  const { data: story, error: loadError } = await db
    .from("stories")
    .select("id, parent_id")
    .eq("id", storyId)
    .maybeSingle();

  if (loadError) return { error: loadError.message };
  if (!story || story.parent_id !== user.id) {
    return { error: "História não encontrada." };
  }

  const { error } = await db
    .from("stories")
    .update({
      visibility,
      is_public: visibility === "public",
    })
    .eq("id", storyId)
    .eq("parent_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/app/parent");
  revalidatePath(`/app/parent/stories/${storyId}`);
  revalidatePath("/app/social");
  return { success: true };
}
