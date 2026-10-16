import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const GAMES_COOKIE = "em_mock_games";

export type QuizProgress = {
  storyId: string;
  parentId: string;
  score: number;
  total: number;
  answers: number[];
  completedAt: string;
};

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decode<T>(raw: string | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

async function readMockGames(): Promise<QuizProgress[]> {
  const store = await cookies();
  return decode<QuizProgress[]>(store.get(GAMES_COOKIE)?.value) ?? [];
}

async function writeMockGames(games: QuizProgress[]) {
  const store = await cookies();
  store.set(GAMES_COOKIE, encode(games.slice(0, 20)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function saveQuizProgress(input: {
  storyId: string;
  parentId: string;
  childId?: string | null;
  title: string;
  questionsData: unknown;
  score: number;
  total: number;
  answers: number[];
}): Promise<{ persistedTo: "supabase" | "mock"; error?: string }> {
  const admin = createAdminClient();
  const userClient = await createClient();
  const db = admin ?? userClient;

  if (db) {
    try {
      const { error } = await db.from("games").insert({
        story_id: input.storyId,
        parent_id: input.parentId,
        child_id: input.childId ?? null,
        game_type: "quiz",
        title: `Quiz — ${input.title}`,
        config: { version: 1 },
        questions_data: input.questionsData,
        score_best: input.score,
      });

      if (!error) {
        return { persistedTo: "supabase" };
      }
    } catch {
      // mock
    }
  }

  const record: QuizProgress = {
    storyId: input.storyId,
    parentId: input.parentId,
    score: input.score,
    total: input.total,
    answers: input.answers,
    completedAt: new Date().toISOString(),
  };
  const existing = await readMockGames();
  await writeMockGames([
    record,
    ...existing.filter((g) => g.storyId !== input.storyId),
  ]);
  return { persistedTo: "mock" };
}

export async function getQuizProgress(
  storyId: string,
  parentId: string,
): Promise<QuizProgress | null> {
  const games = await readMockGames();
  return (
    games.find((g) => g.storyId === storyId && g.parentId === parentId) ?? null
  );
}
