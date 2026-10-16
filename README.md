# Estúdio Mágico

SaaS B2C para pais gerarem histórias infantis personalizadas com IA (avatar LoRA da criança).

Stack: Next.js (App Router), TypeScript, Tailwind CSS, Shadcn UI, Lucide, Supabase.

## Pré-requisitos

- Node.js 20+
- Conta Supabase (projeto `zlzgkivktvnyvehjwcjw`)

## Setup local

```bash
npm install
cp .env.local.example .env.local
# Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY
```

## Desenvolvimento (porta 8080)

```bash
npm run dev
```

Abra [http://127.0.0.1:8080](http://127.0.0.1:8080).

Script equivalente: `next dev -H 0.0.0.0 -p 8080`.

## Schema Supabase

O SQL da Fase 1 está em [`supabase/schema.sql`](./supabase/schema.sql).

**Não aplica automaticamente.** Revise e execute manualmente no SQL Editor do Supabase após aprovação.

Tabelas: `users`, `children`, `characters`, `story_templates`, `stories`, `story_images`, `games`, `subscription_limits` — com FKs e RLS.

## Scripts

| Comando        | Descrição                          |
|----------------|------------------------------------|
| `npm run dev`  | Dev server em `0.0.0.0:8080`       |
| `npm run build`| Build de produção                  |
| `npm run start`| Serve build em `0.0.0.0:8080`      |
| `npm run lint` | ESLint                             |

## Fase atual

Fase 1 — infraestrutura (app + schema). Auth, onboarding e gerador ficam para fases seguintes.
