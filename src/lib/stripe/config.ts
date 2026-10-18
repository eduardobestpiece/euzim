/** Stripe env helpers — projeto Euzim only. */

export function getStripeSecretKey(): string {
  return process.env.STRIPE_SECRET_KEY?.trim() ?? "";
}

export function getStripePublishableKey(): string {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? "";
}

export function getStripeWebhookSecret(): string {
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";
}

/** Chave secreta válida para a API (sk_test_ / sk_live_ / rk_). */
export function isStripeSecretValid(): boolean {
  const key = getStripeSecretKey();
  if (!key) return false;
  if (key.startsWith("mk_")) return false;
  return (
    key.startsWith("sk_test_") ||
    key.startsWith("sk_live_") ||
    key.startsWith("rk_test_") ||
    key.startsWith("rk_live_")
  );
}

export function isStripePublishableConfigured(): boolean {
  const key = getStripePublishableKey();
  return Boolean(key && (key.startsWith("pk_test_") || key.startsWith("pk_live_")));
}

export function isStripeWebhookConfigured(): boolean {
  const secret = getStripeWebhookSecret();
  return Boolean(secret && secret.startsWith("whsec_"));
}

/** Checkout real: basta sk_ + pk_. Webhook é opcional (success page também fulfills). */
export function isStripeCheckoutReady(): boolean {
  return isStripeSecretValid() && isStripePublishableConfigured();
}

/** Keys faltando para abrir Checkout (não inclui whsec_). */
export function stripeMissingKeys(): string[] {
  const missing: string[] = [];
  if (!isStripeSecretValid()) {
    missing.push("STRIPE_SECRET_KEY (sk_test_… ou sk_live_…)");
  }
  if (!isStripePublishableConfigured()) {
    missing.push("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (pk_test_… ou pk_live_…)");
  }
  return missing;
}

/**
 * Mensagem de bloqueio para UI / gate do Checkout.
 * Webhook (whsec_) é opcional — fulfillment também roda na página de sucesso —
 * e não deve aparecer para o usuário.
 */
export function describeStripeKeyIssue(): string | null {
  const key = getStripeSecretKey();
  if (!key) return "STRIPE_SECRET_KEY ausente.";
  if (key.startsWith("mk_")) {
    return "STRIPE_SECRET_KEY parece ser o ID da chave (mk_…), não o secret. Use sk_test_… / sk_live_… do Dashboard → API keys.";
  }
  if (!isStripeSecretValid()) {
    return "STRIPE_SECRET_KEY em formato não reconhecido pela API Stripe.";
  }
  if (!isStripePublishableConfigured()) {
    return "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ausente.";
  }
  return null;
}
