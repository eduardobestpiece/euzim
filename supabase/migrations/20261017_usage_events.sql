-- usage_events — medição de tokens/custo OpenAI por usuário e categoria
CREATE TABLE IF NOT EXISTS public.usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  category text NOT NULL,
  provider text NOT NULL DEFAULT 'openai',
  model text,
  operation text,
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  estimated_usd numeric(12, 6) NOT NULL DEFAULT 0,
  estimated_brl numeric(12, 6) NOT NULL DEFAULT 0,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT usage_events_category_check CHECK (
    category IN (
      'avatar_pixar',
      'story_text',
      'story_image',
      'story_quiz',
      'story_clarify',
      'other'
    )
  ),
  CONSTRAINT usage_events_tokens_nonneg CHECK (
    prompt_tokens >= 0
    AND completion_tokens >= 0
    AND total_tokens >= 0
  ),
  CONSTRAINT usage_events_cost_nonneg CHECK (
    estimated_usd >= 0 AND estimated_brl >= 0
  )
);

CREATE INDEX IF NOT EXISTS usage_events_user_created_idx
  ON public.usage_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS usage_events_category_created_idx
  ON public.usage_events (category, created_at DESC);

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY usage_events_select_own_or_admin
  ON public.usage_events FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_admin());

CREATE POLICY usage_events_insert_own_or_admin
  ON public.usage_events FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR private.is_admin());

GRANT SELECT, INSERT ON public.usage_events TO authenticated;
