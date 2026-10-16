const PLACEHOLDER_KEY = "your-anon-or-publishable-key-here";

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return false;
  if (key === PLACEHOLDER_KEY) return false;
  if (key.includes("your-anon") || key.includes("placeholder")) return false;
  if (!url.includes("supabase.co") && !url.startsWith("http")) return false;

  return true;
}

export function getSupabaseEnv() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  };
}
