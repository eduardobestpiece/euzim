import { connection } from "next/server";
import { AppShell } from "@/components/app/app-shell";
import { ParentDashboard } from "@/components/parent/parent-dashboard";
import { AvatarRefreshBanner } from "@/components/parent/avatar-refresh-banner";
import type { BillingSnapshot } from "@/components/parent/subscription-panel";
import type { CharacterManageRow, ChildFamilyMeta } from "@/lib/characters/types";
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

  let characters: CharacterManageRow[] = [];
  let childName: string | null = null;
  let childAvatarUrl: string | null = null;
  let childAgeYears: number | null = null;
  let childMeta: ChildFamilyMeta | null = null;
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
    childAgeYears = onboarding?.child?.ageYears ?? null;
    if (childName) {
      characters = [{ id: "mock-primary", name: childName, isPrimary: true }];
      if (onboarding?.friend?.displayName) {
        characters.push({
          id: "mock-friend",
          name: onboarding.friend.displayName,
          isPrimary: false,
          kind: onboarding.friend.kind,
        });
      }
    }
  } else {
    const db = createAdminClient() ?? (await createClient());
    if (db) {
      const { data: chars } = await db
        .from("characters")
        .select(
          "id, name, is_primary, avatar_url, relationship, relationship_other, gender, birth_date, kind, description",
        )
        .eq("parent_id", user.id)
        .order("created_at", { ascending: true });

      if (chars) {
        characters = chars.map((c) => ({
          id: c.id,
          name: c.name,
          isPrimary: Boolean(c.is_primary),
          avatarUrl: c.avatar_url,
          relationship: c.relationship,
          relationshipOther: c.relationship_other,
          gender: c.gender,
          birthDate: c.birth_date,
          kind: c.kind,
          description: c.description,
        }));
      }

      const { data: children } = await db
        .from("children")
        .select(
          "id, display_name, avatar_url, birth_date, gender, preferences, has_father, father_name, father_birth_date, has_mother, mother_name, mother_birth_date",
        )
        .eq("parent_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1);

      const child = children?.[0];
      childName = child?.display_name ?? null;
      childAvatarUrl = child?.avatar_url ?? null;
      if (child) {
        childMeta = {
          id: child.id,
          displayName: child.display_name,
          birthDate: child.birth_date,
          gender: child.gender,
          hasFather: Boolean(child.has_father),
          fatherName: child.father_name,
          fatherBirthDate: child.father_birth_date,
          hasMother: Boolean(child.has_mother),
          motherName: child.mother_name,
          motherBirthDate: child.mother_birth_date,
        };
      }
      const prefs = (child?.preferences ?? {}) as {
        age_years?: number;
      };
      if (typeof prefs.age_years === "number") {
        childAgeYears = prefs.age_years;
      } else if (child?.birth_date) {
        const d = new Date(child.birth_date);
        if (!Number.isNaN(d.getTime())) {
          const now = new Date();
          let age = now.getFullYear() - d.getFullYear();
          const m = now.getMonth() - d.getMonth();
          if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
          if (age >= 0 && age < 18) childAgeYears = age;
        }
      }

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
  const refreshStatus = await getAvatarRefreshStatus(user.id);

  return (
    <AppShell user={user} title="Área dos pais">
      <div className="space-y-4">
        <AvatarRefreshBanner status={refreshStatus} />
        <ParentDashboard
          usage={usage}
          characters={characters}
          childName={childName}
          childAvatarUrl={childAvatarUrl}
          childAgeYears={childAgeYears}
          childMeta={childMeta}
          stories={stories}
          billing={billing}
        />
      </div>
    </AppShell>
  );
}
