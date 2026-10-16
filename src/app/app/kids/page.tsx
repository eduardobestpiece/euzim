import { AppShell } from "@/components/app/app-shell";
import { getCurrentUser } from "@/lib/auth/get-user";

export default async function KidsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <AppShell user={user} title="Área kids">
      <div className="space-y-3">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Espaço das crianças
        </h1>
        <p className="max-w-xl text-muted-foreground">
          Rota protegida pronta. A experiência kids (PIN gate, histórias e
          jogos) entra nas próximas fases.
        </p>
      </div>
    </AppShell>
  );
}
