"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCurrentUser } from "@/lib/auth/get-user";

export type ChangePasswordResult = {
  error?: string;
  success?: boolean;
};

export async function changePasswordAction(
  _prev: ChangePasswordResult,
  formData: FormData,
): Promise<ChangePasswordResult> {
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: "Preencha senha atual, nova senha e confirmação." };
  }
  if (newPassword.length < 8) {
    return { error: "A nova senha deve ter pelo menos 8 caracteres." };
  }
  if (newPassword !== confirmPassword) {
    return { error: "A nova senha e a confirmação não coincidem." };
  }
  if (newPassword === currentPassword) {
    return { error: "A nova senha deve ser diferente da atual." };
  }

  const user = await getCurrentUser();
  if (!user?.email) {
    return { error: "Faça login para alterar a senha." };
  }

  if (!isSupabaseConfigured() || user.isMock) {
    return {
      error:
        "Alteração de senha disponível apenas com conta Supabase real (não mock).",
    };
  }

  const supabase = await createClient();
  if (!supabase) return { error: "Supabase indisponível." };

  // Reautentica com a senha atual antes de updateUser
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (reauthError) {
    return { error: "Senha atual incorreta." };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (updateError) {
    return { error: updateError.message || "Não foi possível atualizar a senha." };
  }

  return { success: true };
}
