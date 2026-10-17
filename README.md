# Estúdio Mágico

SaaS B2C para pais gerarem histórias infantis personalizadas com IA (avatar LoRA da criança).

Stack: Next.js (App Router), TypeScript, Tailwind CSS, Shadcn UI, Lucide, Supabase.

**Porta do app: `5050`.** A porta `8080` é reservada para BP Sales — não use neste Project.

## Pré-requisitos

- Node.js 20+
- Conta Supabase (projeto `zlzgkivktvnyvehjwcjw`) — opcional em dev (modo mock)

## Setup local

```bash
npm install
cp .env.local.example .env.local
# Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY
# Se deixar placeholders, o app usa modo mock (Auth + onboarding locais)
```

## Desenvolvimento (porta 5050)

```bash
npm run dev
```

Abra [http://127.0.0.1:5050](http://127.0.0.1:5050).

Script: `next dev -H 0.0.0.0 -p 5050`.

## Schema Supabase

O SQL da Fase 1 está em [`supabase/schema.sql`](./supabase/schema.sql).

**Não aplica automaticamente.** Revise e execute manualmente no SQL Editor do Supabase após aprovação.

Tabelas: `users`, `children`, `characters`, `story_templates`, `stories`, `story_images`, `games`, `subscription_limits`, `usage_events`, `analytics_sessions` — com FKs e RLS.

Migrações incrementais em [`supabase/migrations/`](./supabase/migrations/). Cotação admin: `USD_BRL_RATE` (default `5.70`).

## Auth e onboarding (Fase 2)

- `/login` e `/signup` — Auth via `@supabase/ssr` (ou mock local)
- `/onboarding` — PIN de segurança, 1ª criança, upload de fotos (simulação LoRA)
- Áreas protegidas: `/app/parent`, `/app/kids`, `/app/admin`

## Scripts

| Comando         | Descrição                         |
|-----------------|-----------------------------------|
| `npm run dev`   | Dev server em `0.0.0.0:5050`      |
| `npm run build` | Build de produção                 |
| `npm run start` | Serve build em `0.0.0.0:5050`     |
| `npm run lint`  | ESLint                            |

## Fases

- **Fase 1** — infraestrutura (app + schema) ✅
- **Fase 2** — Auth + onboarding + rotas protegidas ✅
- **Fase 3** — Painel Pais (tracker 15), Personagens upsell, Kids + PIN Guard ✅
- **Fase 4** — Motor gerador mock (Nova História, 4 páginas + Unsplash) ✅
- **Contador Sábio + Pixar v2** — pipeline draft→review→atos→imagens→quiz IA, wizard (tipo/volume/elenco/clarify), admin de custos (`usage_events`), MagicalLoading, wallpaper, stamp `v18-admin-costs-story` ✅
- Fases seguintes — share, Stripe live

## Schema remoto

Aplique `supabase/schema.sql` no SQL Editor do projeto `zlzgkivktvnyvehjwcjw`.
A secret key autentica a API REST, mas **não** executa DDL. Ver `scripts/apply-schema.mjs`.

## GitHub

https://github.com/euzimgeral/euzim

> Nota: o PAT atual só tem Contents write em `euzim`. O repo `estudio-magico` foi criado na conta, mas o token fine-grained não consegue push nele até incluir o repositório nas permissões.
