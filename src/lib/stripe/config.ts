/** Stripe env helpers — dual mode: test no local (:5050), live em produção. */

export type StripeMode = "test" | "live";

/**
 * Local / desenvolvimento → test.
 * Produção → live.
 * Override: STRIPE_MODE=test|live
 */
export function isStripeTestMode(): boolean {
  const forced = process.env.STRIPE_MODE?.trim().toLowerCase();
  if (forced === "live") return false;
  if (forced === "test") return true;

  const appEnv = process.env.APP_ENV?.trim().toLowerCase();
  if (appEnv === "local" || appEnv === "development" || appEnv === "dev") {
    return true;
  }

  return process.env.NODE_ENV === "development";
}

export function getStripeMode(): StripeMode {
  return isStripeTestMode() ? "test" : "live";
}

export function getStripeSecretKeyLive(): string {
  return process.env.STRIPE_SECRET_KEY?.trim() ?? "";
}

export function getStripeSecretKeyTest(): string {
  return process.env.STRIPE_SECRET_KEY_TEST?.trim() ?? "";
}

/** Secret do modo atual (checkout / webhook / customer). */
export function getStripeSecretKey(): string {
  if (isStripeTestMode()) {
    return getStripeSecretKeyTest() || getStripeSecretKeyLive();
  }
  return getStripeSecretKeyLive();
}

export function getStripePublishableKey(): string {
  if (isStripeTestMode()) {
    const test =
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST?.trim() ?? "";
    if (test) return test;
    const main = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? "";
    // Só reutiliza a chave principal se já for pk_test (nunca pk_live no modo test).
    if (main.startsWith("pk_test_")) return main;
    return "";
  }
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? "";
}

export function getStripeWebhookSecret(): string {
  if (isStripeTestMode()) {
    return (
      process.env.STRIPE_WEBHOOK_SECRET_TEST?.trim() ||
      process.env.STRIPE_WEBHOOK_SECRET?.trim() ||
      ""
    );
  }
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";
}

function isSecretShape(key: string): boolean {
  if (!key || key.startsWith("mk_")) return false;
  return (
    key.startsWith("sk_test_") ||
    key.startsWith("sk_live_") ||
    key.startsWith("rk_test_") ||
    key.startsWith("rk_live_")
  );
}

/** Chave secreta válida para a API (sk_test_ / sk_live_ / rk_). */
export function isStripeSecretValid(): boolean {
  return isSecretShape(getStripeSecretKey());
}

export function isStripePublishableConfigured(): boolean {
  const key = getStripePublishableKey();
  return Boolean(
    key && (key.startsWith("pk_test_") || key.startsWith("pk_live_")),
  );
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
  const mode = getStripeMode();
  if (!isStripeSecretValid()) {
    missing.push(
      mode === "test"
        ? "STRIPE_SECRET_KEY_TEST (sk_test_…)"
        : "STRIPE_SECRET_KEY (sk_live_…)",
    );
  }
  if (!isStripePublishableConfigured()) {
    missing.push(
      mode === "test"
        ? "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST (pk_test_…)"
        : "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (pk_live_…)",
    );
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
  const mode = getStripeMode();
  if (!key) {
    return mode === "test"
      ? "STRIPE_SECRET_KEY_TEST ausente (modo test local)."
      : "STRIPE_SECRET_KEY ausente.";
  }
  if (key.startsWith("mk_")) {
    return "STRIPE_SECRET_KEY parece ser o ID da chave (mk_…), não o secret. Use sk_test_… / sk_live_… do Dashboard → API keys.";
  }
  if (!isStripeSecretValid()) {
    return "STRIPE_SECRET_KEY em formato não reconhecido pela API Stripe.";
  }
  if (mode === "test" && key.startsWith("sk_live_")) {
    return "Modo test ativo, mas a secret em uso é sk_live_. Configure STRIPE_SECRET_KEY_TEST.";
  }
  if (mode === "live" && key.startsWith("sk_test_")) {
    return "Modo live ativo, mas a secret em uso é sk_test_. Configure STRIPE_SECRET_KEY (sk_live_).";
  }
  if (!isStripePublishableConfigured()) {
    return mode === "test"
      ? "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST (pk_test_…) ausente. Cole a publishable do Dashboard da conta test."
      : "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ausente.";
  }
  return null;
}

export function stripeModeLabel(): string {
  return getStripeMode() === "test" ? "Stripe Test" : "Stripe Live";
}
