import { BookOpen, Gamepad2, Star } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { PinGuardButton } from "@/components/kids/pin-guard";
import { getCurrentUser } from "@/lib/auth/get-user";
import { readMockOnboarding } from "@/lib/auth/mock-session";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function KidsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const childName =
    !isSupabaseConfigured() || user.isMock
      ? (await readMockOnboarding())?.child?.displayName
      : null;

  return (
    <AppShell user={user} title="Área kids" kidsMode>
      <div className="space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
              Olá{childName ? `, ${childName}` : ""}!
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              Este é o seu cantinho mágico. Histórias e jogos chegam em breve —
              por enquanto explore o espaço.
            </p>
          </div>
          <PinGuardButton label="Voltar aos pais" href="/app/parent" />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <KidsTile
            icon={BookOpen}
            title="Histórias"
            body="Suas aventuras personalizadas aparecerão aqui."
          />
          <KidsTile
            icon={Gamepad2}
            title="Jogos"
            body="Quiz e desafios depois de cada história."
          />
          <KidsTile
            icon={Star}
            title="Favoritos"
            body="Guarde as histórias que mais gostar."
          />
        </div>
      </div>
    </AppShell>
  );
}

function KidsTile({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof BookOpen;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-[radial-gradient(ellipse_at_top,_oklch(0.96_0.03_85),_transparent_70%)] p-5">
      <Icon className="mb-3 size-6 text-amber-700" />
      <p className="font-heading text-lg font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
