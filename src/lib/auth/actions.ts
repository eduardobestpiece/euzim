"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  clearMockSession,
  createMockUserId,
  readMockOnboarding,
  readMockSession,
  writeMockOnboarding,
  writeMockSession,
} from "@/lib/auth/mock-session";
import type { OnboardingPhotoDraft } from "@/lib/auth/types";
import { finishAvatarOnboardingAction } from "@/lib/onboarding/actions";

export type AuthActionResult = {
  error?: string;
  success?: boolean;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function signUpAction(
  _prev: AuthActionResult,
  formData: FormData,
): Promise<AuthActionResult> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();

  if (!email || !password || password.length < 6) {
    return { error: "Informe e-mail e senha (mín. 6 caracteres)." };
  }

  if (!isSupabaseConfigured()) {
    await writeMockSession({
      id: createMockUserId(),
      email,
      role: "parent",
      fullName: fullName || undefined,
      onboardingCompleted: false,
    });
    await writeMockOnboarding({
      securityPin: "",
      child: null,
      childPhotos: [],
      friend: null,
      friendPhotos: [],
      completed: false,
    });
    redirect("/onboarding");
  }

  const supabase = await createClient();
  if (!supabase) return { error: "Supabase indisponível." };

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName || undefined } },
  });

  if (error) return { error: error.message };

  redirect("/onboarding");
}

export async function signInAction(
  _prev: AuthActionResult,
  formData: FormData,
): Promise<AuthActionResult> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Informe e-mail e senha." };
  }

  if (!isSupabaseConfigured()) {
    const existing = await readMockSession();
    if (existing && existing.email === email) {
      redirect(
        existing.onboardingCompleted ? "/app/parent" : "/onboarding",
      );
    }

    await writeMockSession({
      id: createMockUserId(),
      email,
      role: email.includes("admin") ? "admin" : "parent",
      onboardingCompleted: false,
    });
    redirect("/onboarding");
  }

  const supabase = await createClient();
  if (!supabase) return { error: "Supabase indisponível." };

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("onboarding_completed, role")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.onboarding_completed) {
      redirect("/onboarding");
    }
    redirect(profile?.role === "admin" ? "/app/admin" : "/app/parent");
  }

  redirect("/app/parent");
}

export async function signOutAction() {
  if (!isSupabaseConfigured()) {
    await clearMockSession();
    redirect("/login");
  }

  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/login");
}

export async function saveSecurityPinAction(
  _prev: AuthActionResult,
  formData: FormData,
): Promise<AuthActionResult> {
  const pin = String(formData.get("pin") ?? "").trim();
  const confirm = String(formData.get("confirmPin") ?? "").trim();

  if (!/^\d{4,6}$/.test(pin)) {
    return { error: "O PIN deve ter 4 a 6 dígitos numéricos." };
  }
  if (pin !== confirm) {
    return { error: "Os PINs não coincidem." };
  }

  if (!isSupabaseConfigured()) {
    const session = await readMockSession();
    if (!session) return { error: "Sessão expirada. Faça login novamente." };

    const current = (await readMockOnboarding()) ?? {
      securityPin: "",
      child: null,
      childPhotos: [],
      friend: null,
      friendPhotos: [],
      completed: false,
    };
    await writeMockOnboarding({ ...current, securityPin: pin });
    return { success: true };
  }

  const supabase = await createClient();
  if (!supabase) return { error: "Supabase indisponível." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { error } = await supabase
    .from("users")
    .update({ security_pin: pin })
    .eq("id", user.id);

  if (error) return { error: error.message };
  return { success: true };
}

export async function saveChildProfileAction(
  _prev: AuthActionResult,
  formData: FormData,
): Promise<AuthActionResult> {
  const displayName = String(formData.get("displayName") ?? "").trim();
  const birthDate = String(formData.get("birthDate") ?? "").trim() || undefined;

  if (!displayName || displayName.length > 80) {
    return { error: "Informe o nome da criança (até 80 caracteres)." };
  }

  if (!isSupabaseConfigured()) {
    const session = await readMockSession();
    if (!session) return { error: "Sessão expirada. Faça login novamente." };

    const current = (await readMockOnboarding()) ?? {
      securityPin: "",
      child: null,
      childPhotos: [],
      friend: null,
      friendPhotos: [],
      completed: false,
    };
    await writeMockOnboarding({
      ...current,
      child: { displayName, birthDate },
    });
    return { success: true };
  }

  const supabase = await createClient();
  if (!supabase) return { error: "Supabase indisponível." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { error } = await supabase.from("children").insert({
    parent_id: user.id,
    display_name: displayName,
    birth_date: birthDate || null,
  });

  if (error) return { error: error.message };
  return { success: true };
}

export async function savePhotosMockAction(
  photos: OnboardingPhotoDraft[],
): Promise<AuthActionResult> {
  if (photos.length < 1) {
    return { error: "Adicione pelo menos uma foto para o avatar." };
  }

  if (!isSupabaseConfigured()) {
    const session = await readMockSession();
    if (!session) return { error: "Sessão expirada. Faça login novamente." };

    const current = (await readMockOnboarding()) ?? {
      securityPin: "",
      child: null,
      childPhotos: [],
      friend: null,
      friendPhotos: [],
      completed: false,
    };
    // Não persistir data URLs em cookies (limite de tamanho) — só metadados.
    const lightPhotos = photos.map(({ id, name, storagePath, slotId }) => ({
      id,
      slotId: slotId || id,
      name,
      storagePath,
      previewUrl: "",
    }));
    await writeMockOnboarding({
      ...current,
      childPhotos: lightPhotos,
      photos: lightPhotos,
    });
    return { success: true };
  }

  // Com Supabase real, o upload iria para Storage; aqui só persiste paths mock no perfil.
  const supabase = await createClient();
  if (!supabase) return { error: "Supabase indisponível." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { data: children } = await supabase
    .from("children")
    .select("id")
    .eq("parent_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);

  const childId = children?.[0]?.id;
  if (!childId) return { error: "Crie o perfil da criança antes das fotos." };

  await supabase
    .from("children")
    .update({
      avatar_url: photos[0]?.previewUrl ?? null,
      avatar_model_id: `lora-pending:${childId}`,
      preferences: {
        lora_training: "simulated",
        photo_paths: photos.map((p) => p.storagePath),
      },
    })
    .eq("id", childId);

  return { success: true };
}

/** @deprecated Use finishAvatarOnboardingAction — mantido para compat. */
export async function completeOnboardingAction(): Promise<AuthActionResult> {
  const result = await finishAvatarOnboardingAction();
  if (result.error) return { error: result.error };
  return { success: true };
}
