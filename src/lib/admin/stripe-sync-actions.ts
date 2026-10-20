"use server";

import { getCurrentUser } from "@/lib/auth/get-user";
import { getStripeMode, stripeModeLabel } from "@/lib/stripe/config";
import { syncStripeTestFromLive } from "@/lib/stripe/sync-test-from-live";
import { readStripeTestPriceMap } from "@/lib/billing/stripe-price-map";

export type StripeAdminStatus = {
  mode: "test" | "live";
  label: string;
  mappedPrices: number;
  generatedAt: string | null;
};

export async function getStripeAdminStatusAction(): Promise<StripeAdminStatus> {
  const map = readStripeTestPriceMap();
  return {
    mode: getStripeMode(),
    label: stripeModeLabel(),
    mappedPrices: Object.keys(map.prices).length,
    generatedAt: map.generatedAt,
  };
}

export async function syncStripeTestFromLiveAction(): Promise<{
  ok: boolean;
  error?: string;
  message?: string;
  mapped?: number;
}> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Faça login." };
  if (user.role !== "admin") return { ok: false, error: "Somente admin." };

  const result = await syncStripeTestFromLive();
  if (!result.ok) {
    return { ok: false, error: result.error || "Falha no sync." };
  }
  return {
    ok: true,
    mapped: result.mapped,
    message: `Espelho Stripe Test atualizado (${result.mapped} prices). Catálogo live intacto.`,
  };
}
