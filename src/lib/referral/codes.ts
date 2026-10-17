import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function randomCode(length = 8): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}

/** Garante que o usuário tem referral_code; retorna o código. */
export async function ensureReferralCode(userId: string): Promise<string | null> {
  const db = createAdminClient() ?? (await createClient());
  if (!db) return null;

  const { data: row } = await db
    .from("users")
    .select("referral_code")
    .eq("id", userId)
    .maybeSingle();

  const existing =
    typeof row?.referral_code === "string" && row.referral_code.length > 0
      ? row.referral_code
      : null;
  if (existing) return existing;

  for (let attempt = 0; attempt < 6; attempt++) {
    const code = randomCode(8);
    const { error } = await db
      .from("users")
      .update({ referral_code: code })
      .eq("id", userId);
    if (!error) return code;
    if (!error.message.toLowerCase().includes("unique")) {
      return null;
    }
  }
  return null;
}

export async function findUserIdByReferralCode(
  code: string,
): Promise<string | null> {
  const normalized = code.trim().toLowerCase();
  if (!normalized) return null;
  const db = createAdminClient() ?? (await createClient());
  if (!db) return null;
  const { data } = await db
    .from("users")
    .select("id")
    .eq("referral_code", normalized)
    .maybeSingle();
  return data?.id ?? null;
}
