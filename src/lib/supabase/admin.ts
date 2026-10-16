import {
  createAdminClient as createServerAdminClient,
  resolveEnv,
} from "@supabase/server/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasSecretKey, isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Admin client via `@supabase/server/core` (auth secret).
 * Só no servidor. Nunca no browser.
 */
export function createAdminClient(): SupabaseClient | null {
  if (!isSupabaseConfigured() || !hasSecretKey()) return null;

  const resolved = resolveEnv();
  if (resolved.error || !resolved.data) return null;

  return createServerAdminClient({ env: resolved.data });
}
