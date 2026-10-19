/** Navega para Embedded Checkout (client_secret) ou fallback URL hosted. */
export function goToCheckout(result: {
  clientSecret?: string;
  sessionId?: string;
  url?: string;
  planId?: string;
  kind?: string;
}): boolean {
  if (typeof window === "undefined") return false;
  if (result.clientSecret) {
    try {
      sessionStorage.setItem("euzim_checkout_cs", result.clientSecret);
      if (result.sessionId) {
        sessionStorage.setItem("euzim_checkout_sid", result.sessionId);
      }
      if (result.planId) {
        sessionStorage.setItem("euzim_checkout_plan", result.planId);
      }
      if (result.kind) {
        sessionStorage.setItem("euzim_checkout_kind", result.kind);
      }
    } catch {
      /* ignore */
    }
    window.location.href = "/app/checkout";
    return true;
  }
  if (result.url) {
    window.location.href = result.url;
    return true;
  }
  return false;
}
