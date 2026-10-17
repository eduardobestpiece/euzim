# Estúdio Mágico

SaaS B2C para pais gerarem histórias infantis personalizadas com IA (avatar Pixar da criança).

Stack: Next.js (App Router), TypeScript, Tailwind CSS, Shadcn UI, Lucide, Supabase, Stripe.

**Porta do app: `5050`.** A porta `8080` é reservada para BP Sales — não use neste Project.

Stamp da plataforma: `v19` (`src/lib/platform-build.ts`).

## Pré-requisitos

- Node.js 20+
- Conta Supabase (projeto `zlzgkivktvnyvehjwcjw`) — opcional em dev (modo mock)

## Setup local

```bash
npm install
cp .env.local.example .env.local
# Preencha Supabase + OPENAI_API_KEY
# Stripe: NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (pk_live_) já basta para UI;
# Checkout real exige STRIPE_SECRET_KEY (sk_/rk_) + STRIPE_WEBHOOK_SECRET (whsec_).
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

### Stripe — bloqueio conhecido

Sem `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`, o Checkout fica desligado (UI + simulação).
Quando liberar a secret, rode:

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
