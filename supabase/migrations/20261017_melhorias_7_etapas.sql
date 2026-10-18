-- Estúdio Mágico — Etapas 4 + 6 (metadados personagens + story_jobs)
-- Projeto: zlzgkivktvnyvehjwcjw only

-- ---------------------------------------------------------------------------
-- children: metadados de pais
-- ---------------------------------------------------------------------------
ALTER TABLE public.children
  ADD COLUMN IF NOT EXISTS has_father boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS father_name text,
  ADD COLUMN IF NOT EXISTS father_birth_date date,
  ADD COLUMN IF NOT EXISTS has_mother boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mother_name text,
  ADD COLUMN IF NOT EXISTS mother_birth_date date;

-- ---------------------------------------------------------------------------
-- characters: parentesco, gênero, nascimento, tipo
-- ---------------------------------------------------------------------------
ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS relationship text,
  ADD COLUMN IF NOT EXISTS relationship_other text,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS kind text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'characters_gender_check'
  ) THEN
    ALTER TABLE public.characters
      ADD CONSTRAINT characters_gender_check
      CHECK (gender IS NULL OR gender IN ('boy', 'girl', 'other', 'male', 'female'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'characters_kind_check'
  ) THEN
    ALTER TABLE public.characters
      ADD CONSTRAINT characters_kind_check
      CHECK (kind IS NULL OR kind IN ('child', 'adult', 'pet', 'toy', 'other'));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- story_jobs: geração em background
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.story_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'ready', 'failed')),
  theme text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  story_id uuid REFERENCES public.stories (id) ON DELETE SET NULL,
  error text,
  progress text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS story_jobs_parent_id_idx ON public.story_jobs (parent_id);
CREATE INDEX IF NOT EXISTS story_jobs_status_idx ON public.story_jobs (status);

DROP TRIGGER IF EXISTS story_jobs_set_updated_at ON public.story_jobs;
CREATE TRIGGER story_jobs_set_updated_at
  BEFORE UPDATE ON public.story_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.story_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS story_jobs_select_own ON public.story_jobs;
CREATE POLICY story_jobs_select_own ON public.story_jobs
  FOR SELECT TO authenticated
  USING (parent_id = auth.uid() OR private.is_admin());

DROP POLICY IF EXISTS story_jobs_insert_own ON public.story_jobs;
CREATE POLICY story_jobs_insert_own ON public.story_jobs
  FOR INSERT TO authenticated
  WITH CHECK (parent_id = auth.uid() OR private.is_admin());

DROP POLICY IF EXISTS story_jobs_update_own ON public.story_jobs;
CREATE POLICY story_jobs_update_own ON public.story_jobs
  FOR UPDATE TO authenticated
  USING (parent_id = auth.uid() OR private.is_admin());

-- ---------------------------------------------------------------------------
-- Planos de assinatura (limites 4 / 10)
-- ---------------------------------------------------------------------------
INSERT INTO public.subscription_limits (
  plan_id, plan_name, max_children, max_stories_per_month, max_characters,
  max_images_per_story, features, is_active
) VALUES
  ('starter', 'Essencial', 2, 4, 2, 8, '{"share": true, "stripe": true}'::jsonb, true),
  ('family', 'Família', 4, 10, 3, 8, '{"share": true, "lora": true, "stripe": true}'::jsonb, true),
  ('extra_story', 'História extra', 1, 1, 0, 8, '{"one_shot": true, "stripe": true}'::jsonb, true)
ON CONFLICT (plan_id) DO UPDATE SET
  plan_name = EXCLUDED.plan_name,
  max_stories_per_month = EXCLUDED.max_stories_per_month,
  max_characters = EXCLUDED.max_characters,
  features = EXCLUDED.features,
  is_active = true,
  updated_at = now();
