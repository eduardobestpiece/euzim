# Euzim

SaaS B2C para pais gerarem histórias infantis personalizadas com IA (avatar Pixar da criança).

Stack: Next.js (App Router), TypeScript, Tailwind CSS, Shadcn UI, Lucide, Supabase, Stripe.

**Porta do app: `5050`.** A porta `8080` é reservada para BP Sales — não use neste Project.

Stamp da plataforma: `v34` (`src/lib/platform-build.ts`). Brand assets em `public/brand/`.

Área Social: `/app/social` (feed 3:1, amizades, curtidas). Convite de perfil: `/invite/[token]`.
Antes de usar Social em produção, aplique `supabase/migrations/20261017_area_social.sql` no projeto `zlzgkivktvnyvehjwcjw`.

## Pré-requisitos

- Node.js 20+
- Conta Supabase (projeto `zlzgkivktvnyvehjwcjw`) — opcional em dev (modo mock)

## Setup local

```bash
npm install
cp .env.local.example .env.local
# Preencha Supabase + OPENAI_API_KEY
# Stripe LIVE: STRIPE_SECRET_KEY + NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY em .env.local
# Price IDs: src/lib/billing/stripe-price-ids.ts
# Webhook (opcional p/ sync assíncrono): STRIPE_WEBHOOK_SECRET (whsec_) no Dashboard
#   endpoint → {APP_URL}/api/stripe/webhook (eventos checkout.session.completed)
```


## Desenvolvimento (porta 5050)

```bash
npm run dev
```

Abra [http://127.0.0.1:5050](http://127.0.0.1:5050).

## Melhorias 7 etapas (v19)

1. Limpeza UX/admin, CTA primeira história, form tema minimalista
2. Quiz reflexivo com shuffle de opções (3–5)
3. Scene Continuity Bible + prop locks nas imagens
4. Metadados de personagens + modal de preço (6+ = R$ 9,90)
5. Wizard: tema → elenco/tipo/linguagem/tamanho → clarify → generate
6. `story_jobs` em background + notificação in-app/browser
7. Planos Stripe R$ 24,90/4 · R$ 49,90/10 · R$ 7,90 extra (Checkout gated sem secret)

SQL: `supabase/migrations/20261017_melhorias_7_etapas.sql`

### Stripe

Checkout exige `STRIPE_SECRET_KEY` (`sk_live_` / `sk_test_`) + `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
`STRIPE_WEBHOOK_SECRET` (`whsec_`) é opcional — sem ele, o fulfillment roda na página de sucesso do Checkout.
Products/Prices:

```bash
node scripts/create-stripe-products.mjs
```

## Scripts úteis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Dev server `0.0.0.0:5050` |
| `node scripts/cleanup-fake-users.mjs` | Mantém só contato@ + eduardocosta@ |
| `node scripts/create-stripe-products.mjs` | Cria Products/Prices (precisa sk_) |

## GitHub

https://github.com/euzimgeral/euzim
