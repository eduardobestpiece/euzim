"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/get-user";
import type { StoryEngine } from "@/lib/stories/generate-pipeline";

export type GenerateStoryResult = {
  error?: string;
  success?: boolean;
  storyId?: string;
  shareToken?: string;
  persistedTo?: "supabase" | "mock";
  engine?: StoryEngine;
  title?: string;
  pages?: number;
};

/**
 * Server Action leve: encaminha para a API longa (pipeline + imagens Pixar).
 * Preferível chamar /api/stories/generate direto do client (já feito no form).
 */
export async function generateStoryAction(
  _prev: GenerateStoryResult,
  formData: FormData,
): Promise<GenerateStoryResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Faça login para gerar uma história." };

  const theme = String(formData.get("theme") ?? "").trim();
  if (!theme) return { error: "Escolha um tema para a história." };

  // Em Server Action não temos URL absoluta estável — o form client usa a API.
  return {
    error:
      "Use o botão Gerar história (API). Atualize a página se este aviso aparecer.",
  };
}

export async function revalidateStoryPaths(storyId: string, shareToken?: string) {
  revalidatePath("/app/parent");
  revalidatePath("/app/kids");
  revalidatePath(`/app/parent/stories/${storyId}`);
  revalidatePath(`/app/kids/read/${storyId}`);
  if (shareToken) revalidatePath(`/story/${shareToken}`);
}
