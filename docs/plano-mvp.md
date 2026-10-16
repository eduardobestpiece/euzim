# Estúdio Mágico — plano MVP (resumo)

## Fases
1. **Infra** — Next.js, Shadcn, schema SQL ✅ (**aplicado** em `zlzgkivktvnyvehjwcjw`)
2. **Auth + onboarding** ✅
3. **Dashboards** — tracker, personagens upsell, Kids + PIN ✅
4. **Gerador** — Nova História (texto/imagens mock 4 páginas) ✅
5. **Kids reader + Quiz Therapy** ✅
6. **Share público + persistência real** ✅
   - `/story/[shareToken]` mobile + CTA fixo
   - `stories` / `story_images` / `games` / `subscription_limits` (+ template cache)
   - mock só como fallback se REST falhar
7. Stripe / LoRA real / IA (futuro)

## Porta
`5050` — usar Try Live na VM cloud

## Supabase
- Projeto: `zlzgkivktvnyvehjwcjw` (nunca Best Piece)
- Keys + `SUPABASE_ACCESS_TOKEN` em `.env.local` (não commitadas)
- Schema: 8 tabelas + RLS aplicados
- Smoke: `node scripts/smoke-persist.mjs`

## GitHub
https://github.com/euzimgeral/euzim — branch `cursor/estudio-magico-fase-6-d189`
