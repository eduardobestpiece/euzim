"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/get-user";
import { saveQuizProgress } from "@/lib/stories/games-store";
import type { QuizQuestion } from "@/lib/stories/quiz";

export type SaveQuizResult = {
  error?: string;
  success?: boolean;
  score?: number;
  persistedTo?: "supabase" | "mock";
};

export async function saveQuizTherapyAction(input: {
  storyId: string;
  title: string;
  questions: QuizQuestion[];
  answers: number[];
}): Promise<SaveQuizResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Faça login para salvar o quiz." };

  if (
    !Array.isArray(input.answers) ||
    input.answers.length !== input.questions.length
  ) {
    return { error: "Responda todas as perguntas." };
  }

  let score = 0;
  input.questions.forEach((q, i) => {
    if (input.answers[i] === q.correctIndex) score += 1;
  });

  const result = await saveQuizProgress({
    storyId: input.storyId,
    parentId: user.id,
    title: input.title,
    questionsData: input.questions.map((q, i) => ({
      ...q,
      chosenIndex: input.answers[i],
    })),
    score,
    total: input.questions.length,
    answers: input.answers,
  });

  revalidatePath(`/app/kids/read/${input.storyId}`);
  revalidatePath("/app/kids");

  return {
    success: true,
    score,
    persistedTo: result.persistedTo,
  };
}
