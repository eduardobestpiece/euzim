import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/get-user";

export default async function ParentSettingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <AppShell user={user} title="Conta">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/app/parent" className="gap-1.5">
              <ArrowLeft className="size-3.5" />
              Voltar
            </Link>
          </Button>
        </div>

        <div className="space-y-2">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Alterar senha
          </h1>
          <p className="max-w-xl text-muted-foreground">
            Informe a senha atual e escolha uma nova para a conta{" "}
            <span className="font-medium text-foreground">{user.email}</span>.
          </p>
        </div>

        <ChangePasswordForm />
      </div>
    </AppShell>
  );
}
