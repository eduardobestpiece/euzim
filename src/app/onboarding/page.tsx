import { redirect } from "next/navigation";
import { SessionHeartbeat } from "@/components/app/session-heartbeat";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { getCurrentUser } from "@/lib/auth/get-user";
import { readMockOnboarding } from "@/lib/auth/mock-session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { loadOnboardingBootstrap } from "@/lib/onboarding/load-reuse-state";
import { getAvatarRefreshStatus } from "@/lib/onboarding/avatar-refresh";
import type { OnboardingState } from "@/lib/auth/types";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const refresh = await getAvatarRefreshStatus(user.id);
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
      };
      if (!resetMode) resetMode = "reuse";
    } else if (bootstrap.resetMode === "reuse" && bootstrap.initialState) {
      initialState = bootstrap.initialState;
    }
  }

  return (
    <main className="flex min-h-full flex-1 justify-center bg-[radial-gradient(ellipse_at_top,_oklch(0.94_0.04_85),_transparent_55%),radial-gradient(ellipse_at_bottom,_oklch(0.93_0.03_200),_transparent_50%)] px-4 py-10 sm:py-14">
      <SessionHeartbeat />
      <OnboardingWizard
        initialState={initialState}
        mockMode={!isSupabaseConfigured() || user.isMock}
        resetMode={resetMode}
      />
    </main>
  );
}
