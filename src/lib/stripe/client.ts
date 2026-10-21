import Stripe from "stripe";
import {
  getStripeSecretKeyLive,
  getStripeSecretKeyTest,
  isStripeTestMode,
} from "@/lib/stripe/config";

const API_VERSION = "2026-09-30.endive" as const;

let stripeLiveSingleton: Stripe | null = null;
let stripeTestSingleton: Stripe | null = null;

function isSecretShape(key: string): boolean {
  if (!key || key.startsWith("mk_")) return false;
  return (
    key.startsWith("sk_test_") ||
    key.startsWith("sk_live_") ||
    key.startsWith("rk_test_") ||
    key.startsWith("rk_live_")
  );
}

function makeClient(key: string): Stripe | null {
  if (!isSecretShape(key)) return null;
  return new Stripe(key, {
    apiVersion: API_VERSION,
    typescript: true,
  });
}

/** Cliente da conta LIVE (catálogo fonte do espelho). */
export function getStripeLive(): Stripe | null {
  const key = getStripeSecretKeyLive();
  if (!isSecretShape(key)) return null;
  if (!stripeLiveSingleton) {
    stripeLiveSingleton = makeClient(key);
  }
  return stripeLiveSingleton;
}

/** Cliente da conta TEST (checkout local / espelho). */
export function getStripeTest(): Stripe | null {
  const key = getStripeSecretKeyTest();
  if (!isSecretShape(key)) return null;
  if (!stripeTestSingleton) {
    stripeTestSingleton = makeClient(key);
  }
  return stripeTestSingleton;
}

/** Client server-only do modo atual. Retorna null se a secret não for sk_/rk_. */
export function getStripe(): Stripe | null {
  return isStripeTestMode() ? getStripeTest() || getStripeLive() : getStripeLive();
}
