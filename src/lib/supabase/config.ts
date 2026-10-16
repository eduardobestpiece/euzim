const PLACEHOLDERS = [
  "your-anon-or-publishable-key-here",
  "your-publishable-key-here",
  "your-publishable-or-anon-key-here",
];

function resolvePublishableKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ""
  );
}

function resolveUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    ""
  );
}

export function isSupabaseConfigured(): boolean {
  const url = resolveUrl();
  const key = resolvePublishableKey();

  if (!url || !key) return false;
  if (PLACEHOLDERS.includes(key)) return false;
  if (key.includes("your-") || key.includes("placeholder")) return false;
  if (!url.includes("supabase.co") && !url.startsWith("http")) return false;

  return true;
}

export function hasSecretKey(): boolean {
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  return Boolean(secret && !secret.includes("masked") && secret.length > 20);
}

export function getSupabaseEnv() {
  return {
    url: resolveUrl(),
    /** Publishable/anon key for browser + SSR clients */
    anonKey: resolvePublishableKey(),
    publishableKey: resolvePublishableKey(),
    jwksUrl: process.env.SUPABASE_JWKS_URL ?? "",
    secretKey: process.env.SUPABASE_SECRET_KEY ?? "",
    projectRef: "zlzgkivktvnyvehjwcjw",
  };
}
