-- Tipo de plano (Pago live / Teste / Presente) — Euzim
-- Projeto: zlzgkivktvnyvehjwcjw only (NUNCA Best Piece)

-- ---------------------------------------------------------------------------
-- users.plan_source: origem do plano ativo
--   paid_live  = Stripe live (produção)
--   paid_test  = Stripe test (localhost)
--   gift       = Presente habilitado pelo Admin (sem cobrança)
--   none       = sem plano
-- ---------------------------------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS plan_source text NOT NULL DEFAULT 'none';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_plan_source_check'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_plan_source_check
      CHECK (plan_source IN ('paid_live', 'paid_test', 'gift', 'none'));
  END IF;
END $$;

-- Renovação / upgrade Stripe (opcional; preferido na UI dos pais)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_current_period_end timestamptz;

CREATE INDEX IF NOT EXISTS users_plan_source_idx
  ON public.users (plan_source)
  WHERE plan_source <> 'none';

-- Backfill conservador: assinatura ativa sem source → paid_live
UPDATE public.users
SET plan_source = 'paid_live'
WHERE plan_source = 'none'
  AND subscription_status IN ('active', 'trialing')
  AND subscription_plan_id IS NOT NULL
  AND coalesce(subscription_plan_id, '') <> '';
