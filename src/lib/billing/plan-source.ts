/** Origem do plano no perfil (`users.plan_source`). */

export const PLAN_SOURCES = ["paid_live", "paid_test", "gift", "none"] as const;

export type PlanSource = (typeof PLAN_SOURCES)[number];

export const PLAN_SOURCE_LABELS: Record<PlanSource, string> = {
  paid_live: "Pago",
  paid_test: "Teste",
  gift: "Presente",
  none: "Sem plano",
};

export function isPlanSource(value: unknown): value is PlanSource {
  return (
    typeof value === "string" &&
    (PLAN_SOURCES as readonly string[]).includes(value)
  );
}

export function normalizePlanSource(value: unknown): PlanSource {
  return isPlanSource(value) ? value : "none";
}

/** Stripe live → paid_live; test → paid_test. */
export function planSourceFromStripeMode(mode: "test" | "live"): PlanSource {
  return mode === "test" ? "paid_test" : "paid_live";
}

/** Avatares base inclusos em qualquer plano (catálogo v61+). */
export const BASE_INCLUDED_AVATARS = 2;
