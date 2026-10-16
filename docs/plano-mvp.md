# Estúdio Mágico — plano MVP (resumo)

## Fases
1. **Infra** — Next.js, Shadcn, schema Supabase (`zlzgkivktvnyvehjwcjw`) ✅
2. **Auth + onboarding** — login/signup, PIN, criança, fotos LoRA simuladas ✅
3. **Dashboards** — Painel Pais (tracker 15), Personagens upsell, Kids + PIN Guard ✅ (este ciclo)
4. Gerador de histórias (IA mock → real)
5. Quiz / jogos
6. Share público + Stripe

## Porta
`5050` (8080 reservada BP Sales)

## Supabase
- Publishable key em `.env.local` (não commitada)
- `SUPABASE_SECRET_KEY` ainda pendente (não inventar)
- Schema em `supabase/schema.sql` — aplicar manualmente após aprovação
