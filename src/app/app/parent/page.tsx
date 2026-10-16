import { connection } from "next/server";
import { AppShell } from "@/components/app/app-shell";
import { ParentDashboard } from "@/components/parent/parent-dashboard";
import { AvatarRefreshBanner } from "@/components/parent/avatar-refresh-banner";
import type { BillingSnapshot } from "@/components/parent/subscription-panel";
import { getCurrentUser } from "@/lib/auth/get-user";
import { readMockOnboarding } from "@/lib/auth/mock-session";
import { MONTHLY_STORY_LIMIT } from "@/lib/billing/character-packs";
import { getAvatarRefreshStatus } from "@/lib/onboarding/avatar-refresh";
import { getStoryUsage } from "@/lib/stories/usage";
import { listStoriesForParent } from "@/lib/stories/load-story";
import { countMockStoriesThisMonth } from "@/lib/stories/mock-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  describeStripeKeyIssue,
  isStripeSecretValid,
  stripeMissingKeys,
} from "@/lib/stripe/config";

export default async function ParentPage() {
  await connection();
  const nowMs = Date.now();
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

  let characters: {
    id: string;
    name: string;
    isPrimary?: boolean;
    avatarUrl?: string | null;
  }[] = [];
  let childName: string | null = null;
  let childAvatarUrl: string | null = null;
  let billing: BillingSnapshot = {
    subscriptionStatus: "none",
    planId: null,
    stripeCustomerId: null,
    extraCharacters: 0,
    stripeReady: isStripeSecretValid(),
    missingKeys: stripeMissingKeys(),
    keyIssue: describeStripeKeyIssue(),
  };

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
        .select("id, name, is_primary, avatar_url")
        .eq("parent_id", user.id)
        .order("created_at", { ascending: true });

      if (chars) {
        characters = chars.map((c) => ({
          id: c.id,
          name: c.name,
          isPrimary: Boolean(c.is_primary),
          avatarUrl: c.avatar_url,
        }));
      }

      const { data: children } = await db
        .from("children")
        .select("display_name, avatar_url")
        .eq("parent_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1);

      childName = children?.[0]?.display_name ?? null;
      childAvatarUrl = children?.[0]?.avatar_url ?? null;

      const { data: profile } = await db
        .from("users")
        .select(
          "subscription_status, subscription_plan_id, stripe_customer_id, extra_characters_available",
        )
        .eq("id", user.id)
        .maybeSingle();

      if (profile) {
        billing = {
          ...billing,
          subscriptionStatus: profile.subscription_status,
          planId: profile.subscription_plan_id,
          stripeCustomerId: profile.stripe_customer_id,
          extraCharacters:
            typeof profile.extra_characters_available === "number"
              ? profile.extra_characters_available
              : 0,
        };
      }
    }

    if (!childName) {
      childName = (await readMockOnboarding())?.child?.displayName ?? null;
      if (childName && characters.length === 0) {
        characters = [{ id: "mock-primary", name: childName, isPrimary: true }];
      }
    }
  }

  const stories = await listStoriesForParent(user.id);
  const refreshStatus = await getAvatarRefreshStatus(user.id, nowMs);

  return (
    <AppShell user={user} title="Área dos pais">
      <div className="space-y-4">
        <AvatarRefreshBanner status={refreshStatus} />
        <ParentDashboard
          usage={usage}
          characters={characters}
          childName={childName}
          childAvatarUrl={childAvatarUrl}
          stories={stories}
          billing={billing}
        />
      </div>
    </AppShell>
  );
}
