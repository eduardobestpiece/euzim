/** Plano de assinatura escolhido na landing (oferta) ou no paywall do onboarding. */
export type SelectedPlanId = "starter" | "family";

export function parseSelectedPlanId(
  value: string | null | undefined,
): SelectedPlanId | null {
  if (value === "starter" || value === "family") return value;
  return null;
}

export function onboardingPathForPlan(planId: SelectedPlanId | null): string {
  if (!planId) return "/onboarding";
  return `/onboarding?plan=${planId}`;
}

export function signupPathForPlan(planId: SelectedPlanId | null): string {
  if (!planId) return "/signup";
  return `/signup?plan=${planId}`;
}
