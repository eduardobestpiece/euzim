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
import { getAvatarRefreshStatus } from "@/lib/onboarding/avatar-refresh";
import { ONBOARDING_BUILD } from "@/lib/onboarding/build";
import type { OnboardingState } from "@/lib/auth/types";

export default async function OnboardingPage() {
  // Obrigatório com cacheComponents antes de relógio / cookies
  await connection();
  const nowMs = Date.now();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const refresh = await getAvatarRefreshStatus(user.id, nowMs);
  if (user.onboardingCompleted && !refresh.due) {
    redirect("/app/parent");
  }

  const cookieState = await readMockOnboarding();
  let initialState: OnboardingState | null = cookieState;
  let resetMode: "full" | "reuse" | null = refresh.due ? "reuse" : null;

  if (isSupabaseConfigured() && !user.isMock) {
    const bootstrap = await loadOnboardingBootstrap(user.id);
    if (bootstrap.resetMode) resetMode = bootstrap.resetMode;
    if ((resetMode === "reuse" || refresh.due) && bootstrap.initialState) {
      initialState = {
        ...bootstrap.initialState,
        securityPin:
          cookieState?.securityPin || bootstrap.initialState.securityPin || "",
        childPhotos:
          bootstrap.initialState.childPhotos.length > 0
            ? bootstrap.initialState.childPhotos
            : cookieState?.childPhotos ?? [],
        friendPhotos:
          cookieState?.friendPhotos ?? bootstrap.initialState.friendPhotos,
        wizardStep:
          cookieState?.wizardStep || bootstrap.initialState.wizardStep || null,
      };
      if (!resetMode) resetMode = "reuse";
    } else if (bootstrap.initialState) {
      // Retoma passo / drafts do cookie + passo salvo no perfil
      initialState = {
        ...(cookieState ?? {
          securityPin: "",
          child: null,
          childPhotos: [],
          friend: null,
          friendPhotos: [],
          completed: false,
        }),
        wizardStep:
          cookieState?.wizardStep || bootstrap.initialState.wizardStep || null,
        securityPin:
          cookieState?.securityPin ||
          bootstrap.initialState.securityPin ||
          "",
      };
    }
  }

  return (
    <main className="relative flex min-h-full flex-1 flex-col bg-[radial-gradient(ellipse_at_top,_oklch(0.94_0.04_85),_transparent_55%),radial-gradient(ellipse_at_bottom,_oklch(0.93_0.03_200),_transparent_50%)]">
      <SessionHeartbeat />
      <header className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="min-w-0 space-y-0.5">
          <p className="truncate text-xs text-muted-foreground sm:text-sm">
            {user.email}
          </p>
          <p className="font-mono text-[10px] text-emerald-800/80">
            build {ONBOARDING_BUILD}
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
        />
      </div>
    </main>
  );
}
