import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  mockSessionToUser,
  readMockSession,
} from "@/lib/auth/mock-session";
import type { AuthUser } from "@/lib/auth/types";

export async function getCurrentUser(): Promise<AuthUser | null> {
  if (!isSupabaseConfigured()) {
    const mock = await readMockSession();
    return mock ? mockSessionToUser(mock) : null;
  }

  const supabase = await createClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("role, full_name, onboarding_completed")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email ?? "",
    role: (profile?.role as "parent" | "admin" | undefined) ?? "parent",
    fullName: profile?.full_name ?? user.user_metadata?.full_name ?? null,
    onboardingCompleted: Boolean(profile?.onboarding_completed),
    isMock: false,
  };
}
