import Stripe from "stripe";
import {
  getStripeSecretKey,
  isStripeSecretValid,
} from "@/lib/stripe/config";

let stripeSingleton: Stripe | null = null;

/** Client server-only. Retorna null se a secret não for sk_/rk_. */
export function getStripe(): Stripe | null {
  if (!isStripeSecretValid()) return null;
  if (!stripeSingleton) {
    stripeSingleton = new Stripe(getStripeSecretKey(), {
      apiVersion: "2026-09-30.endive",
      typescript: true,
    });
  }
  return stripeSingleton;
}
