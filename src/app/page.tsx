import Link from "next/link";
import { BookOpen } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import { HasAccountGate } from "@/components/referral/has-account-gate";
import { getCurrentUser } from "@/lib/auth/get-user";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { redirect } from "next/navigation";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; channel?: string }>;
}) {
  const params = await searchParams;
  const mockMode = !isSupabaseConfigured();
  const hasRef = Boolean(params.ref && params.ref.trim());
  const user = await getCurrentUser();

  if (hasRef && user) {
    redirect(user.onboardingCompleted ? "/app/parent" : "/onboarding");
  }

  return (
    <div className="relative flex min-h-full flex-1 flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_oklch(0.92_0.04_85)_0%,_transparent_55%),radial-gradient(ellipse_at_bottom_right,_oklch(0.9_0.06_200)_0%,_transparent_45%)]"
      />
      <header className="relative z-10 flex items-center justify-between px-6 py-5 md:px-10">
        <BrandLogo size="header" priority />
        <div className="flex gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Entrar</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/signup">Criar conta</Link>
          </Button>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-6 pb-20 pt-8 md:px-10">
        {hasRef && !user ? (
          <HasAccountGate nextPath="/onboarding" />
        ) : (
          <>
            <div className="space-y-5">
              <BrandLogo
                size="auth"
                href={null}
                priority
                className="h-16 sm:h-20"
              />
              <h1 className="max-w-xl text-xl leading-relaxed text-foreground/80 md:text-2xl">
                Histórias infantis personalizadas com o avatar da sua criança.
              </h1>
              <p className="max-w-lg text-base leading-relaxed text-muted-foreground">
                Crie aventuras mágicas, leia no modo Kids e compartilhe com a
                família.
              </p>
              {mockMode ? (
                <p className="text-sm text-amber-800">
                  Modo demo — configure `.env.local` com o projeto da conta quando
                  for usar login real.
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="gap-2">
                <Link href="/signup">
                  <BookOpen className="size-4" aria-hidden />
                  Começar
                </Link>
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
