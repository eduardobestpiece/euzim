/**
 * Contas canônicas do Euzim — fallback quando o perfil REST falha/timeout
 * ou quando o app está em modo demo (env Supabase ausente).
 */
export type KnownAccount = {
  role: "admin" | "parent";
  onboardingCompleted: boolean;
};

const KNOWN: Record<string, KnownAccount> = {
  "contato@bpsales.com.br": {
    role: "admin",
    onboardingCompleted: true,
  },
  "eduardocosta@bpsales.com.br": {
    role: "parent",
    onboardingCompleted: true,
  },
};

export function knownAccountForEmail(
  email: string | null | undefined,
): KnownAccount | null {
  if (!email) return null;
  return KNOWN[email.trim().toLowerCase()] ?? null;
}
