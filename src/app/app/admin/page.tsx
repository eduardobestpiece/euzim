import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { getCurrentUser } from "@/lib/auth/get-user";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role !== "admin") redirect("/app/parent");

  return (
    <AppShell user={user} title="Admin">
      <div className="space-y-3">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Administração
        </h1>
        <p className="max-w-xl text-muted-foreground">
          Área admin reservada. Templates e limites de assinatura serão
          gerenciados aqui nas fases seguintes.
        </p>
      </div>
    </AppShell>
  );
}
