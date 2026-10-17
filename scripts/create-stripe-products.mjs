/**
 * Cria Products/Prices Stripe dos planos Estúdio Mágico.
 * Requer STRIPE_SECRET_KEY (sk_live_/rk_live_ com Products/Prices Write).
 * Projeto Euzim — não Best Piece.
 *
 * Produtos:
 *  - Assinatura Essencial R$ 24,90/mês → 4 histórias
 *  - Assinatura Família R$ 49,90/mês → 10 histórias
 *  - História adicional R$ 7,90 (one-shot)
 *
 * Uso: node scripts/create-stripe-products.mjs
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Stripe from "stripe";

function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    /* ignore */
  }
}

loadEnv();

const key = process.env.STRIPE_SECRET_KEY?.trim() || "";
if (!key || key.startsWith("mk_") || !(key.startsWith("sk_") || key.startsWith("rk_"))) {
  console.error(
    "BLOQUEIO: STRIPE_SECRET_KEY ausente ou inválida.\n" +
      "Configure sk_live_… (ou Restricted Key com Products/Prices/Checkout/Customers Write)\n" +
      "e rode de novo. A publishable key sozinha NÃO cria produtos.",
  );
  process.exit(2);
}

const stripe = new Stripe(key);

const PRODUCTS = [
  {
    name: "Estúdio Mágico — Plano Essencial",
    description: "4 histórias por mês",
    metadata: { plan_id: "starter", stories_per_month: "4" },
    price: { unit_amount: 2490, currency: "brl", recurring: { interval: "month" } },
  },
  {
    name: "Estúdio Mágico — Plano Família",
    description: "10 histórias por mês",
    metadata: { plan_id: "family", stories_per_month: "10" },
    price: { unit_amount: 4990, currency: "brl", recurring: { interval: "month" } },
  },
  {
    name: "Estúdio Mágico — História adicional",
    description: "1 história extra (pagamento único)",
    metadata: { plan_id: "extra_story", stories: "1" },
    price: { unit_amount: 790, currency: "brl" },
  },
];

for (const spec of PRODUCTS) {
  const product = await stripe.products.create({
    name: spec.name,
    description: spec.description,
    metadata: spec.metadata,
  });
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: spec.price.unit_amount,
    currency: spec.price.currency,
    ...(spec.price.recurring ? { recurring: spec.price.recurring } : {}),
    metadata: spec.metadata,
  });
  console.log(JSON.stringify({ product: product.id, price: price.id, plan: spec.metadata.plan_id }));
}

console.log("OK — cole os price ids no Dashboard / env se quiser price_ fixos.");
