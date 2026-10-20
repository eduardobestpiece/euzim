import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  mockSessionToUser,
  readMockOnboarding,
  readMockSession,
} from "@/lib/auth/mock-session";
import type { AuthUser } from "@/lib/auth/types";

async function getCurrentUserUncached(): Promise<AuthUser | null> {
  if (!isSupabaseConfigured()) {
    const mock = await readMockSession();
    return mock ? mockSessionToUser(mock) : null;
  }

  const supabase = await createClient();
  if (!supabase) return null;

  // Preferir getSession (cookie). getUser() → rede Auth (~5s+) e, com AAAA
  // lento, AuthRetryableFetchError que trava a :5050 / HMR.
  let user: {
    id: string;
    email?: string | null;
    user_metadata?: { full_name?: string };
  } | null = null;

  try {
    const sessionRace = Promise.race([
      supabase.auth.getSession().then((r) => r.data.session?.user ?? null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
    ]);
    user = await sessionRace;
  } catch {
    user = null;
  }

  if (!user) {
    // Auth real configurado, mas sessão pode ser só mock local
    const mock = await readMockSession();
    return mock ? mockSessionToUser(mock) : null;
  }

  let profile: {
    role?: string | null;
    full_name?: string | null;
    onboarding_completed?: boolean | null;
  } | null = null;
  let profileError: { message?: string } | null = null;
  try {
    const profileRace = Promise.race([
      supabase
        .from("users")
        .select("role, full_name, onboarding_completed")
        .eq("id", user.id)
        .maybeSingle(),
      new Promise<{ data: null; error: { message: string } }>((resolve) =>
        setTimeout(
          () => resolve({ data: null, error: { message: "profile-timeout" } }),
          3000,
        ),
      ),
    ]);
    const res = await profileRace;
    profile = res.data;
    profileError = res.error;
  } catch {
    profileError = { message: "profile-failed" };
  }

  if (profileError && !profile) {
    // Schema ainda não aplicado — usa onboarding mock se existir
    const onboarding = await readMockOnboarding();
    return {
      id: user.id,
      email: user.email ?? "",
      role: "parent",
      fullName: user.user_metadata?.full_name ?? null,
      onboardingCompleted: Boolean(
        onboarding?.completed ||
          (onboarding?.securityPin &&
            onboarding?.child &&
            (onboarding.childPhotos?.length || onboarding.photos?.length)),
      ),
      isMock: false,
    };
  }

  return {
    id: user.id,
    email: user.email ?? "",
    role: (profile?.role as "parent" | "admin" | undefined) ?? "parent",
    fullName: profile?.full_name ?? user.user_metadata?.full_name ?? null,
    onboardingCompleted: Boolean(profile?.onboarding_completed),
    isMock: false,
  };
}

/** Deduplica getUser+profile no mesmo request (layout + page). */
export const getCurrentUser = cache(getCurrentUserUncached);
