import { cookies } from "next/headers";

const STORIES_COOKIE = "em_mock_stories";

export type MockStoryPage = {
  pageIndex: number;
  text: string;
  imageUrl: string;
  altText: string;
};

export type MockStoryRecord = {
  id: string;
  parentId: string;
  childId: string;
  title: string;
  status: "ready";
  textContent: { pages: { index: number; text: string }[] };
  coverImageUrl: string;
  pages: MockStoryPage[];
  questionsData?: unknown[];
  createdAt: string;
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

export async function readMockStories(): Promise<MockStoryRecord[]> {
  const store = await cookies();
  return decode<MockStoryRecord[]>(store.get(STORIES_COOKIE)?.value) ?? [];
}

export async function writeMockStories(stories: MockStoryRecord[]) {
  const store = await cookies();
  // Manter só as 10 mais recentes para não estourar cookie
  const trimmed = stories.slice(0, 10).map((s) => ({
    ...s,
    // não guardar textos gigantes demais
    pages: s.pages.map((p) => ({
      ...p,
      text: p.text.slice(0, 500),
    })),
  }));
  store.set(STORIES_COOKIE, encode(trimmed), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function countMockStoriesThisMonth(parentId: string): Promise<number> {
  const stories = await readMockStories();
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return stories.filter(
    (s) => s.parentId === parentId && new Date(s.createdAt) >= start,
  ).length;
}
