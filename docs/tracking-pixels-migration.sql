-- Euzim — tracking pixels / tags / webhooks + phone (idempotente)
-- Projeto alvo SOMENTE: zlzgkivktvnyvehjwcjw
-- Aplicar no SQL Editor do Supabase se a API/MCP não puder fazer DDL.

-- ---------------------------------------------------------------------------
-- users.phone (já pode existir via 20261017_perfil_users_phone_cpf)
-- ---------------------------------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS phone text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_phone_len'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_phone_len
      CHECK (phone IS NULL OR char_length(phone) BETWEEN 8 AND 20);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- tracking_pixels — Meta / Google Ads / GA4
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tracking_pixels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('meta', 'google_ads', 'ga4')),
  label text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  -- Meta
  pixel_id text,
  capi_access_token text,
  -- Google Ads (AW-…)
  aw_id text,
  conversion_labels jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- GA4 (G-…)
  measurement_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tracking_pixels_meta_fields CHECK (
    kind <> 'meta' OR (pixel_id IS NOT NULL AND char_length(pixel_id) > 0)
  ),
  CONSTRAINT tracking_pixels_ads_fields CHECK (
    kind <> 'google_ads' OR (aw_id IS NOT NULL AND char_length(aw_id) > 0)
  ),
  CONSTRAINT tracking_pixels_ga4_fields CHECK (
    kind <> 'ga4' OR (measurement_id IS NOT NULL AND char_length(measurement_id) > 0)
  )
);

CREATE INDEX IF NOT EXISTS tracking_pixels_kind_active_idx
  ON public.tracking_pixels (kind, is_active);

DROP TRIGGER IF EXISTS tracking_pixels_set_updated_at ON public.tracking_pixels;
CREATE TRIGGER tracking_pixels_set_updated_at
  BEFORE UPDATE ON public.tracking_pixels
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.tracking_pixels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tracking_pixels_admin_all ON public.tracking_pixels;
CREATE POLICY tracking_pixels_admin_all
  ON public.tracking_pixels
  FOR ALL
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

-- Leitura pública só de pixels ativos sem token (via view)
CREATE OR REPLACE VIEW public.tracking_pixels_public AS
SELECT
  id,
  kind,
  label,
  is_active,
  pixel_id,
  aw_id,
  conversion_labels,
  measurement_id
FROM public.tracking_pixels
WHERE is_active = true;

GRANT SELECT ON public.tracking_pixels_public TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- tracking_tags — HTML/JS custom no head
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tracking_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  html text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS tracking_tags_set_updated_at ON public.tracking_tags;
CREATE TRIGGER tracking_tags_set_updated_at
  BEFORE UPDATE ON public.tracking_tags
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.tracking_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tracking_tags_admin_all ON public.tracking_tags;
CREATE POLICY tracking_tags_admin_all
  ON public.tracking_tags
  FOR ALL
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

CREATE OR REPLACE VIEW public.tracking_tags_public AS
SELECT id, name, html, is_active
FROM public.tracking_tags
WHERE is_active = true;

GRANT SELECT ON public.tracking_tags_public TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- tracking_webhooks — outbound + eventos selecionáveis
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tracking_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL DEFAULT '',
  url text NOT NULL,
  secret text,
  is_active boolean NOT NULL DEFAULT true,
  -- Array de chaves: Lead, InitiateCheckout, AddPaymentInfo, Purchase,
  -- CompleteRegistration, PageView
  events text[] NOT NULL DEFAULT ARRAY[
    'Lead',
    'InitiateCheckout',
    'AddPaymentInfo',
    'Purchase',
    'CompleteRegistration'
  ]::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS tracking_webhooks_set_updated_at ON public.tracking_webhooks;
CREATE TRIGGER tracking_webhooks_set_updated_at
  BEFORE UPDATE ON public.tracking_webhooks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.tracking_webhooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tracking_webhooks_admin_all ON public.tracking_webhooks;
CREATE POLICY tracking_webhooks_admin_all
  ON public.tracking_webhooks
  FOR ALL
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

-- ---------------------------------------------------------------------------
-- Log de falhas de webhook (admin-only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tracking_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid REFERENCES public.tracking_webhooks (id) ON DELETE SET NULL,
  event_key text,
  status_code integer,
  ok boolean NOT NULL DEFAULT false,
  error text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tracking_webhook_logs_created_idx
  ON public.tracking_webhook_logs (created_at DESC);

ALTER TABLE public.tracking_webhook_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tracking_webhook_logs_admin_select ON public.tracking_webhook_logs;
CREATE POLICY tracking_webhook_logs_admin_select
  ON public.tracking_webhook_logs
  FOR SELECT
  USING (private.is_admin());

DROP POLICY IF EXISTS tracking_webhook_logs_admin_insert ON public.tracking_webhook_logs;
CREATE POLICY tracking_webhook_logs_admin_insert
  ON public.tracking_webhook_logs
  FOR INSERT
  WITH CHECK (private.is_admin());

-- ---------------------------------------------------------------------------
-- Grants service role (já bypassa RLS; explícito para clareza)
-- ---------------------------------------------------------------------------
GRANT ALL ON public.tracking_pixels TO service_role;
GRANT ALL ON public.tracking_tags TO service_role;
GRANT ALL ON public.tracking_webhooks TO service_role;
GRANT ALL ON public.tracking_webhook_logs TO service_role;
