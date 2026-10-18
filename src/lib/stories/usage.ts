import { cookies } from "next/headers";
import { MONTHLY_STORY_LIMIT } from "@/lib/billing/character-packs";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCurrentUser } from "@/lib/auth/get-user";

const MOCK_USAGE_COOKIE = "em_mock_story_usage";

export type StoryUsage = {
  used: number;
  limit: number;
  source: "mock" | "supabase" | "fallback";
  planId?: string;
};

async function resolveMonthlyLimit(planId?: string | null): Promise<number> {
  const db = createAdminClient() ?? (await createClient());
  if (!db) return MONTHLY_STORY_LIMIT;

  const id = planId || "family";
  const { data } = await db
    .from("subscription_limits")
    .select("max_stories_per_month, plan_id")
    .eq("plan_id", id)
    .eq("is_active", true)
    .maybeSingle();

  if (data?.max_stories_per_month != null) {
    return data.max_stories_per_month;
  }

  const { data: free } = await db
    .from("subscription_limits")
    .select("max_stories_per_month")
    .eq("plan_id", "free")
    .maybeSingle();

  return free?.max_stories_per_month ?? MONTHLY_STORY_LIMIT;
}

export async function getStoryUsage(): Promise<StoryUsage> {
  const user = await getCurrentUser();

  if (isSupabaseConfigured() && user) {
    try {
      const db = createAdminClient() ?? (await createClient());
      if (db) {
        let planId: string | null = "family";
        const { data: profile } = await db
          .from("users")
          .select("subscription_plan_id")
          .eq("id", user.id)
          .maybeSingle();
        planId = profile?.subscription_plan_id ?? "family";

        const limit = await resolveMonthlyLimit(planId);

        const start = new Date();
        start.setDate(1);
        start.setHours(0, 0, 0, 0);

        const { count, error } = await db
          .from("stories")
          .select("id", { count: "exact", head: true })
          .eq("parent_id", user.id)
          .gte("created_at", start.toISOString());

        if (!error && typeof count === "number") {
          return {
            used: count,
            limit,
            source: "supabase",
            planId: planId ?? undefined,
          };
        }
      }
    } catch {
      // fallback
    }
  }

  const store = await cookies();
  const raw = store.get(MOCK_USAGE_COOKIE)?.value;
  const used = raw ? Number.parseInt(raw, 10) : 0;
  return {
    used: Number.isFinite(used) ? used : 0,
    limit: MONTHLY_STORY_LIMIT,
    source: user?.isMock ? "mock" : "fallback",
  };
}
