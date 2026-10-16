-- Onboarding guides — gender + avatar refresh (só zlzgkivktvnyvehjwcjw)
ALTER TABLE public.children
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS avatar_photos_captured_at timestamptz,
  ADD COLUMN IF NOT EXISTS avatar_refresh_due_at timestamptz;

ALTER TABLE public.children
  DROP CONSTRAINT IF EXISTS children_gender_check;

ALTER TABLE public.children
  ADD CONSTRAINT children_gender_check
  CHECK (gender IS NULL OR gender IN ('boy', 'girl', 'other'));

CREATE INDEX IF NOT EXISTS children_avatar_refresh_due_at_idx
  ON public.children (avatar_refresh_due_at)
  WHERE avatar_refresh_due_at IS NOT NULL;

NOTIFY pgrst, 'reload schema';
