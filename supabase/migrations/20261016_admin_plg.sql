-- Admin PLG — só zlzgkivktvnyvehjwcjw
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_story_at timestamptz,
  ADD COLUMN IF NOT EXISTS complimentary_until timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_reset_mode text,
  ADD COLUMN IF NOT EXISTS admin_notes text;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_onboarding_reset_mode_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_onboarding_reset_mode_check
  CHECK (
    onboarding_reset_mode IS NULL
    OR onboarding_reset_mode IN ('full', 'reuse')
  );

CREATE INDEX IF NOT EXISTS users_last_active_at_idx
  ON public.users (last_active_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS users_subscription_status_idx
  ON public.users (subscription_status);

CREATE TABLE IF NOT EXISTS public.analytics_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  duration_seconds integer NOT NULL DEFAULT 0,
  path_sample text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT analytics_sessions_duration_nonneg CHECK (duration_seconds >= 0)
);

CREATE INDEX IF NOT EXISTS analytics_sessions_user_last_seen_idx
  ON public.analytics_sessions (user_id, last_seen_at DESC);

ALTER TABLE public.analytics_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS analytics_sessions_insert_own ON public.analytics_sessions;
CREATE POLICY analytics_sessions_insert_own
  ON public.analytics_sessions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR private.is_admin());

DROP POLICY IF EXISTS analytics_sessions_update_own ON public.analytics_sessions;
CREATE POLICY analytics_sessions_update_own
  ON public.analytics_sessions FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR private.is_admin())
  WITH CHECK (user_id = auth.uid() OR private.is_admin());

DROP POLICY IF EXISTS analytics_sessions_select_own_or_admin ON public.analytics_sessions;
CREATE POLICY analytics_sessions_select_own_or_admin
  ON public.analytics_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_admin());

NOTIFY pgrst, 'reload schema';
