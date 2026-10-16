import { BookOpen } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { getCurrentUser } from "@/lib/auth/get-user";
import { readMockOnboarding } from "@/lib/auth/mock-session";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function ParentPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const onboarding = isSupabaseConfigured()
    ? null
    : await readMockOnboarding();

  return (
    <AppShell user={user} title="Área dos pais">
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Olá{user.fullName ? `, ${user.fullName}` : ""}
          </h1>
          <p className="max-w-xl text-muted-foreground">
            Painel dos pais preparado na Fase 2. O gerador de histórias e o
            dashboard completo chegam na Fase 3.
          </p>
        </div>

        <div className="space-y-3 border-t border-border/60 pt-6">
          <p className="flex items-center gap-2 text-sm font-medium">
            <BookOpen className="size-4" />
            Resumo do onboarding
          </p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>
              Criança:{" "}
              {onboarding?.child?.displayName ??
                "(conecte o Supabase para carregar do banco)"}
            </li>
            <li>PIN: {onboarding?.securityPin ? "definido" : "—"}</li>
            <li>
              Fotos avatar: {onboarding?.photos.length ?? 0} (simulação LoRA)
            </li>
          </ul>
        </div>
      </div>
    </AppShell>
  );
}
