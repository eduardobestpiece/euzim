"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function digitsOnly(v: string): string {
  return v.replace(/\D/g, "");
}

export async function updateProfileAction(input: {
  fullName: string;
  phone: string;
  cpf: string;
}): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Faça login." };

  const fullName = input.fullName.trim().slice(0, 120);
  const phoneRaw = input.phone.trim();
  const phone = phoneRaw ? digitsOnly(phoneRaw) : "";
  const cpf = input.cpf ? digitsOnly(input.cpf) : "";

  if (phone && (phone.length < 8 || phone.length > 20)) {
    return { error: "Telefone inválido." };
  }
  if (cpf && cpf.length !== 11) {
    return { error: "CPF deve ter 11 dígitos." };
  }

  const db = createAdminClient() ?? (await createClient());
  if (!db) return { error: "Conta indisponível." };

  const { error } = await db
    .from("users")
    .update({
      full_name: fullName || null,
      display_name: fullName || null,
      phone: phone || null,
      cpf: cpf || null,
    })
    .eq("id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/app/parent/settings");
  revalidatePath("/app/parent");
  return {};
}
