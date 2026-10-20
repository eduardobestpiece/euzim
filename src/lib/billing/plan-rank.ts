import { SUBSCRIPTION_PLANS, type StoryPlan } from "@/lib/billing/plans";

const PLAN_RANK: Record<string, number> = {
  starter: 1,
  family: 2,
  plus: 3,
};

export function planRank(planId: string | null | undefined): number {
  return PLAN_RANK[planId || ""] ?? 0;
}

export function plansAbove(
  currentPlanId: string | null | undefined,
): StoryPlan[] {
  const rank = planRank(currentPlanId);
  return SUBSCRIPTION_PLANS.filter((p) => planRank(p.planId) > rank);
}
