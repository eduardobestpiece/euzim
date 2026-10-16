"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { readMockOnboarding, readMockSession } from "@/lib/auth/mock-session";

export async function verifyParentPinAction(
  pin: string,
): Promise<{ error?: string; success?: boolean }> {
  const trimmed = pin.trim();
  if (!/^\d{4,6}$/.test(trimmed)) {
    return { error: "Informe um PIN com 4 a 6 dígitos." };
  }

  if (!isSupabaseConfigured()) {
    const session = await readMockSession();
    if (!session) return { error: "Sessão expirada." };
    const onboarding = await readMockOnboarding();
    if (!onboarding?.securityPin) {
      return { error: "PIN ainda não configurado. Refaça o onboarding." };
    }
    if (onboarding.securityPin !== trimmed) {
      return { error: "PIN incorreto." };
    }
    return { success: true };
  }

  const supabase = await createClient();
  if (!supabase) return { error: "Supabase indisponível." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { data: profile, error } = await supabase
    .from("users")
    .select("security_pin")
    .eq("id", user.id)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!profile?.security_pin) {
    return { error: "PIN ainda não configurado." };
  }
  if (profile.security_pin !== trimmed) {
    return { error: "PIN incorreto." };
  }

  return { success: true };
}
