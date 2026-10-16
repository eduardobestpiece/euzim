import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv, hasSecretKey, isSupabaseConfigured } from "@/lib/supabase/config";

/** Client admin (service/secret) — só no servidor. Nunca expor ao browser. */
export function createAdminClient(): SupabaseClient | null {
  if (!isSupabaseConfigured() || !hasSecretKey()) return null;

  const { url, secretKey } = getSupabaseEnv();
  return createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
