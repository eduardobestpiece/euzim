import { cookies } from "next/headers";
import { MONTHLY_STORY_LIMIT } from "@/lib/billing/character-packs";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCurrentUser } from "@/lib/auth/get-user";

const MOCK_USAGE_COOKIE = "em_mock_story_usage";

export type StoryUsage = {
  used: number;
  limit: number;
  source: "mock" | "supabase" | "fallback";
};

export async function getStoryUsage(): Promise<StoryUsage> {
  const user = await getCurrentUser();

  if (isSupabaseConfigured() && user && !user.isMock) {
    try {
      const supabase = await createClient();
      if (supabase) {
        const start = new Date();
        start.setDate(1);
        start.setHours(0, 0, 0, 0);

        const { count, error } = await supabase
          .from("stories")
          .select("id", { count: "exact", head: true })
          .eq("parent_id", user.id)
          .gte("created_at", start.toISOString());

        if (!error && typeof count === "number") {
          return {
            used: count,
            limit: MONTHLY_STORY_LIMIT,
            source: "supabase",
          };
        }
      }
    } catch {
      // schema pode ainda não estar aplicado
    }
  }

  const store = await cookies();
  const raw = store.get(MOCK_USAGE_COOKIE)?.value;
  const used = raw ? Number.parseInt(raw, 10) : 3;
  return {
    used: Number.isFinite(used) ? used : 3,
    limit: MONTHLY_STORY_LIMIT,
    source: user?.isMock ? "mock" : "fallback",
  };
}
