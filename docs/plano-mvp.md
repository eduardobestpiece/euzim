# Estúdio Mágico — plano MVP (resumo)

## Fases
1. **Infra** — Next.js, Shadcn, schema SQL ✅ (`zlzgkivktvnyvehjwcjw`)
2. **Auth + onboarding avatar** ✅ — wizard obrigatório: PIN → filho (12 fotos) → melhor amigo (12 fotos) → preview LoRA → painel
3. **Dashboards** — tracker, personagens upsell, Kids + PIN ✅
4. **Gerador** — Nova História (OpenAI texto + Unsplash) ✅
5. **Kids reader + Quiz Therapy** ✅
6. **Share público + persistência real** ✅
7. **Stripe** — código pronto; aguarda `sk_test_/pk_/whsec_` (chave `mk_` = ID, não secret)
8. LoRA real / pipeline de treino (futuro)

## Feeling
Login → onboarding de avatar **antes** de qualquer “criar história”. Parent home destaca o avatar da criança.

## Porta
`5050` — Try Live na VM cloud

## Supabase
- Projeto: `zlzgkivktvnyvehjwcjw` (nunca Best Piece)
- Keys em `.env.local` (não commitadas)
- Storage bucket `avatars`
- Smoke: `node scripts/smoke-persist.mjs` · `node scripts/seed-users.mjs`

## GitHub
https://github.com/euzimgeral/euzim — branch `cursor/estudio-magico-onboarding-avatar-d189`
