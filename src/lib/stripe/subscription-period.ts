import type Stripe from "stripe";

/** Stripe SDK v23+: período fica no SubscriptionItem. */
export function subscriptionPeriodEndIso(
  sub: Stripe.Subscription,
): string | null {
  const end =
    sub.items?.data?.[0]?.current_period_end ??
    (sub as { current_period_end?: number }).current_period_end;
  if (typeof end !== "number" || !Number.isFinite(end)) return null;
  return new Date(end * 1000).toISOString();
}
