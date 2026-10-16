import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { getCurrentUser } from "@/lib/auth/get-user";
import { readMockOnboarding } from "@/lib/auth/mock-session";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.onboardingCompleted) redirect("/app/parent");

  // Estado parcial do wizard (cookie mock + retomada)
  const initialState = await readMockOnboarding();

  return (
    <main className="flex min-h-full flex-1 justify-center bg-[radial-gradient(ellipse_at_top,_oklch(0.94_0.04_85),_transparent_55%),radial-gradient(ellipse_at_bottom,_oklch(0.93_0.03_200),_transparent_50%)] px-4 py-10 sm:py-14">
      <OnboardingWizard
        initialState={initialState}
        mockMode={!isSupabaseConfigured() || user.isMock}
      />
    </main>
  );
}
