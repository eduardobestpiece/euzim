import { AppShell } from "@/components/app/app-shell";
import { ParentDashboard } from "@/components/parent/parent-dashboard";
import { getCurrentUser } from "@/lib/auth/get-user";
import { readMockOnboarding } from "@/lib/auth/mock-session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getStoryUsage } from "@/lib/stories/usage";

export default async function ParentPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const usage = await getStoryUsage();
  let characters: { id: string; name: string; isPrimary?: boolean }[] = [];
  let childName: string | null = null;

  if (!isSupabaseConfigured() || user.isMock) {
    const onboarding = await readMockOnboarding();
    childName = onboarding?.child?.displayName ?? null;
    if (childName) {
      characters = [
        {
          id: "mock-primary",
          name: childName,
          isPrimary: true,
        },
      ];
    }
  } else {
    const supabase = await createClient();
    if (supabase) {
      const { data: chars } = await supabase
        .from("characters")
        .select("id, name, is_primary")
        .eq("parent_id", user.id)
        .order("created_at", { ascending: true });

      characters =
        chars?.map((c) => ({
          id: c.id,
          name: c.name,
          isPrimary: Boolean(c.is_primary),
        })) ?? [];

      const { data: children } = await supabase
        .from("children")
        .select("display_name")
        .eq("parent_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1);

      childName = children?.[0]?.display_name ?? null;
    }
  }

  return (
    <AppShell user={user} title="Área dos pais">
      <ParentDashboard
        usage={usage}
        characters={characters}
        childName={childName}
      />
    </AppShell>
  );
}
