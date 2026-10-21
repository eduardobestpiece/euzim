-- Presentes por indicação — Euzim
-- Projeto: zlzgkivktvnyvehjwcjw only (NUNCA Best Piece)

-- ---------------------------------------------------------------------------
-- users: código próprio, indicador, flag de 1ª recompensa + créditos de história
-- ---------------------------------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referral_rewarded_at timestamptz,
  ADD COLUMN IF NOT EXISTS extra_stories_available integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_referral_code_unique'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_referral_code_unique UNIQUE (referral_code);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_extra_stories_available_check'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_extra_stories_available_check
      CHECK (extra_stories_available >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS users_referred_by_idx
  ON public.users (referred_by)
  WHERE referred_by IS NOT NULL;

-- Backfill códigos para usuários existentes (8 chars alfanuméricos)
UPDATE public.users
SET referral_code = lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
WHERE referral_code IS NULL;

-- ---------------------------------------------------------------------------
-- Gera referral_code no signup (estende handle_new_user)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  code text;
  attempts int := 0;
BEGIN
  LOOP
    code := lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    BEGIN
      INSERT INTO public.users (id, email, full_name, role, referral_code)
      VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
        'parent',
        code
      )
      ON CONFLICT (id) DO NOTHING;
      EXIT;
    EXCEPTION
      WHEN unique_violation THEN
        attempts := attempts + 1;
        IF attempts > 5 THEN
          INSERT INTO public.users (id, email, full_name, role, referral_code)
          VALUES (
            NEW.id,
            NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
            'parent',
            lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
          )
          ON CONFLICT (id) DO NOTHING;
          EXIT;
        END IF;
    END;
  END LOOP;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- referral_clicks — audit de último clique (opcional)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.referral_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  channel text NOT NULL
    CHECK (channel IN ('story', 'friend_invite', 'app_share', 'other')),
  story_id uuid,
  invite_token text,
  clicked_at timestamptz NOT NULL DEFAULT now(),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS referral_clicks_code_idx
  ON public.referral_clicks (code, clicked_at DESC);

ALTER TABLE public.referral_clicks ENABLE ROW LEVEL SECURITY;

-- Apenas service role grava; authenticated não lê (audit interno)
DROP POLICY IF EXISTS referral_clicks_admin_select ON public.referral_clicks;
CREATE POLICY referral_clicks_admin_select
  ON public.referral_clicks FOR SELECT TO authenticated
  USING (private.is_admin());

-- ---------------------------------------------------------------------------
-- referral_rewards — uma linha por referee (idempotente)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.referral_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  referee_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  plan_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending_choice'
    CHECK (status IN ('pending_choice', 'claimed', 'void')),
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  chosen jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  CONSTRAINT referral_rewards_referee_unique UNIQUE (referee_id)
);

CREATE INDEX IF NOT EXISTS referral_rewards_referrer_status_idx
  ON public.referral_rewards (referrer_id, status);

ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS referral_rewards_select_own ON public.referral_rewards;
CREATE POLICY referral_rewards_select_own
  ON public.referral_rewards FOR SELECT TO authenticated
  USING (
    referrer_id = auth.uid()
    OR referee_id = auth.uid()
    OR private.is_admin()
  );

DROP POLICY IF EXISTS referral_rewards_update_own ON public.referral_rewards;
CREATE POLICY referral_rewards_update_own
  ON public.referral_rewards FOR UPDATE TO authenticated
  USING (referrer_id = auth.uid() OR private.is_admin())
  WITH CHECK (referrer_id = auth.uid() OR private.is_admin());

-- Inserts só via service role (webhook)

-- ---------------------------------------------------------------------------
-- notifications — in-app leve
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  href text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_admin());

DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
CREATE POLICY notifications_update_own
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR private.is_admin())
  WITH CHECK (user_id = auth.uid() OR private.is_admin());
