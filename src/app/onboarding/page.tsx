import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { SessionHeartbeat } from "@/components/app/session-heartbeat";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/lib/auth/actions";
import { getCurrentUser } from "@/lib/auth/get-user";
import { readMockOnboarding } from "@/lib/auth/mock-session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { loadOnboardingBootstrap } from "@/lib/onboarding/load-reuse-state";
import { ONBOARDING_BUILD } from "@/lib/onboarding/build";
import { normalizeSecurityPin } from "@/lib/onboarding/pin-format";
import { parseSelectedPlanId } from "@/lib/billing/selected-plan";
import type { OnboardingState } from "@/lib/auth/types";

/** Geração Pixar no fluxo pode passar de 60s. */
export const maxDuration = 300;

function OnboardingFallback() {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
      Carregando onboarding…
    </main>
  );
}

async function OnboardingPageInner({
  searchParams,
}: {
  searchParams: Promise<{ resume?: string; paid?: string; plan?: string }>;
}) {
  // cacheComponents: connection() opts into request time — dentro de Suspense
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const params = await searchParams;
  const preferredPlan = parseSelectedPlanId(params.plan);
  const resumeAfterPay =
    params.resume === "1" ||
    params.resume === "generating" ||
    params.paid === "1";

  const cookieState = await readMockOnboarding();
  let initialState: OnboardingState | null = cookieState;
  let resetMode: "full" | "reuse" | null = null;

  if (isSupabaseConfigured() && !user.isMock) {
    const bootstrap = await loadOnboardingBootstrap(user.id);
    if (bootstrap.resetMode) resetMode = bootstrap.resetMode;

    if (user.onboardingCompleted && resetMode !== "reuse") {
      redirect("/app/parent");
    }

    if (bootstrap.initialState) {
      const fromDb = bootstrap.initialState;
      const fromCookie = cookieState;
      initialState = {
        securityPin:
          normalizeSecurityPin(fromCookie?.securityPin) ||
          normalizeSecurityPin(fromDb.securityPin) ||
          "",
        child: fromCookie?.child ?? fromDb.child,
        childPhotos:
          fromDb.childPhotos.length > 0
            ? fromDb.childPhotos
            : (fromCookie?.childPhotos ?? []),
        friend: fromCookie?.friend ?? fromDb.friend,
        friendPhotos:
          fromDb.friendPhotos.length > 0
            ? fromDb.friendPhotos
            : (fromCookie?.friendPhotos ?? []),
        childAvatarUrl:
          fromDb.childAvatarUrl ?? fromCookie?.childAvatarUrl ?? null,
        friendAvatarUrl:
          fromDb.friendAvatarUrl ?? fromCookie?.friendAvatarUrl ?? null,
        childFaceSheetUrl: fromDb.childFaceSheetUrl ?? null,
        childBodySheetUrl: fromDb.childBodySheetUrl ?? null,
        friendSheetUrl: fromDb.friendSheetUrl ?? null,
        // DB manda no passo — cookie stale ("preview") fazia voltar ao Pronto após o PIN
        wizardStep: fromDb.wizardStep || fromCookie?.wizardStep || null,
        completed: false,
      };
    } else if (user.onboardingCompleted) {
      redirect("/app/parent");
    }
  } else if (user.onboardingCompleted) {
    redirect("/app/parent");
  }

  return (
    <main className="relative flex min-h-full flex-1 flex-col bg-[radial-gradient(ellipse_at_top,_oklch(0.94_0.04_85),_transparent_55%),radial-gradient(ellipse_at_bottom,_oklch(0.93_0.03_200),_transparent_50%)]">
      <SessionHeartbeat />
      <header className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="min-w-0 space-y-0.5">
          <p className="truncate text-xs text-muted-foreground sm:text-sm">
            {user.email}
          </p>
          <p className="font-mono text-[10px] font-semibold text-emerald-800">
            build {ONBOARDING_BUILD} · PIN por último
          </p>
        </div>
        <form action={signOutAction}>
          <Button type="submit" variant="outline" size="sm" className="gap-1.5">
            <LogOut className="size-3.5" />
            Sair
          </Button>
        </form>
      </header>
      <div className="flex flex-1 justify-center px-4 pb-10 pt-2 sm:pb-14 sm:pt-4">
        <OnboardingWizard
          initialState={initialState}
          mockMode={!isSupabaseConfigured() || user.isMock}
          resetMode={resetMode}
          resumeAfterPay={resumeAfterPay}
          preferredPlan={preferredPlan}
        />
      </div>
    </main>
  );
}

export default function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ resume?: string; paid?: string; plan?: string }>;
}) {
  return (
    <Suspense fallback={<OnboardingFallback />}>
      <OnboardingPageInner searchParams={searchParams} />
    </Suspense>
  );
}
