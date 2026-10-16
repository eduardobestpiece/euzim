import { getCurrentUser } from "@/lib/auth/get-user";
import type { AuthUser } from "@/lib/auth/types";

export async function requireAdmin(): Promise<
  { user: AuthUser } | { error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { error: "Não autenticado." };
  if (user.role !== "admin") return { error: "Acesso restrito a admin." };
  return { user };
}
