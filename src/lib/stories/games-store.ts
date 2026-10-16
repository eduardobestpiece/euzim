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
      let childId = input.childId ?? null;
      if (!childId) {
        const { data: storyRow } = await db
          .from("stories")
          .select("child_id")
          .eq("id", input.storyId)
          .maybeSingle();
        childId = storyRow?.child_id ?? null;
      }

      const { error } = await db.from("games").insert({
        story_id: input.storyId,
        parent_id: input.parentId,
        child_id: childId,
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
  const admin = createAdminClient();
  const userClient = await createClient();
  const db = admin ?? userClient;

  if (db) {
    try {
      const { data } = await db
        .from("games")
        .select("score_best, questions_data, created_at")
        .eq("story_id", storyId)
        .eq("parent_id", parentId)
        .eq("game_type", "quiz")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        const raw = data.questions_data;
        const answers = Array.isArray(raw)
          ? raw.map((q) => {
              if (q && typeof q === "object" && "chosenIndex" in q) {
                const chosen = (q as { chosenIndex?: unknown }).chosenIndex;
                return typeof chosen === "number" ? chosen : -1;
              }
              return -1;
            })
          : [];
        return {
          storyId,
          parentId,
          score: data.score_best ?? 0,
          total: answers.length || 0,
          answers,
          completedAt: data.created_at ?? new Date().toISOString(),
        };
      }
    } catch {
      // mock
    }
  }

  const games = await readMockGames();
  return (
    games.find((g) => g.storyId === storyId && g.parentId === parentId) ?? null
  );
}
