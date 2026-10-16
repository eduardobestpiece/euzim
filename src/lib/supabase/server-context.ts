import { createSupabaseContext } from "@supabase/server";
import { getSupabaseEnv, hasSecretKey, isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Helper baseado em @supabase/server (createSupabaseContext).
 * Usa publishable key do projeto zlzgkivktvnyvehjwcjw.
 * Sem SUPABASE_SECRET_KEY, modos "secret"/admin ficam indisponíveis.
 */
export async function createServerSupabaseContext(
  request: Request,
  auth: "none" | "publishable" | "user" = "publishable",
) {
  if (!isSupabaseConfigured()) {
    return {
      data: null,
      error: new Error("Supabase não configurado (faltam URL/publishable key)."),
    } as const;
  }

  if (auth === ("secret" as string) && !hasSecretKey()) {
    return {
      data: null,
      error: new Error(
        "SUPABASE_SECRET_KEY ausente — não é possível usar auth secret/admin.",
      ),
    } as const;
  }

  const env = getSupabaseEnv();

  return createSupabaseContext(request, {
    auth,
    env: {
      url: env.url,
      publishableKeys: { default: env.publishableKey },
      ...(hasSecretKey()
        ? { secretKeys: { default: env.secretKey } }
        : {}),
      ...(env.jwksUrl ? { jwks: new URL(env.jwksUrl) } : {}),
    },
  });
}

export { hasSecretKey };
