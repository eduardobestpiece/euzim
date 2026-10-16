import { AppShell } from "@/components/app/app-shell";
import { ParentDashboard } from "@/components/parent/parent-dashboard";
import { getCurrentUser } from "@/lib/auth/get-user";
import { readMockOnboarding } from "@/lib/auth/mock-session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStoryUsage } from "@/lib/stories/usage";
import { listStoriesForParent } from "@/lib/stories/load-story";
import { countMockStoriesThisMonth } from "@/lib/stories/mock-store";
import { MONTHLY_STORY_LIMIT } from "@/lib/billing/character-packs";

export default async function ParentPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  let usage = await getStoryUsage();
  if (usage.source !== "supabase") {
    const mockCount = await countMockStoriesThisMonth(user.id);
    usage = {
      used: Math.max(usage.used, mockCount),
      limit: MONTHLY_STORY_LIMIT,
      source: usage.source,
    };
  }

  let characters: { id: string; name: string; isPrimary?: boolean }[] = [];
  let childName: string | null = null;

  if (!isSupabaseConfigured() || user.isMock) {
    const onboarding = await readMockOnboarding();
    childName = onboarding?.child?.displayName ?? null;
    if (childName) {
      characters = [{ id: "mock-primary", name: childName, isPrimary: true }];
    }
  } else {
    const db = createAdminClient() ?? (await createClient());
    if (db) {
      const { data: chars } = await db
        .from("characters")
        .select("id, name, is_primary")
        .eq("parent_id", user.id)
        .order("created_at", { ascending: true });

      if (chars) {
        characters = chars.map((c) => ({
          id: c.id,
          name: c.name,
          isPrimary: Boolean(c.is_primary),
        }));
      }

      const { data: children } = await db
        .from("children")
        .select("display_name")
        .eq("parent_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1);

      childName = children?.[0]?.display_name ?? null;
    }

    if (!childName) {
      childName = (await readMockOnboarding())?.child?.displayName ?? null;
      if (childName && characters.length === 0) {
        characters = [{ id: "mock-primary", name: childName, isPrimary: true }];
      }
    }
  }

  const stories = await listStoriesForParent(user.id);

  return (
    <AppShell user={user} title="Área dos pais">
      <ParentDashboard
        usage={usage}
        characters={characters}
        childName={childName}
        stories={stories}
      />
    </AppShell>
  );
}
