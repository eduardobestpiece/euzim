import Link from "next/link";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/get-user";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role !== "admin") redirect("/app/parent");

  return (
    <AppShell user={user} title="Admin">
      <div className="space-y-4">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Administração
        </h1>
        <p className="max-w-xl text-muted-foreground">
          Área admin reservada. Templates e limites de assinatura serão
          gerenciados aqui nas fases seguintes.
        </p>
        <Button asChild variant="outline">
          <Link href="/app/admin/settings" className="gap-1.5">
            <KeyRound className="size-3.5" />
            Alterar senha
          </Link>
        </Button>
      </div>
    </AppShell>
  );
}
