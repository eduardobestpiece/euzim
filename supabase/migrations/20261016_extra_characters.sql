-- Extra characters from Stripe upsell packs (Euzim / zlzgkivktvnyvehjwcjw)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS extra_characters_available integer NOT NULL DEFAULT 0;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_extra_characters_nonneg;

ALTER TABLE public.users
  ADD CONSTRAINT users_extra_characters_nonneg
  CHECK (extra_characters_available >= 0);

-- Align family plan with MVP brief (15 stories / month, 1 base character)
INSERT INTO public.subscription_limits (
  plan_id, plan_name, max_children, max_stories_per_month, max_characters, max_images_per_story, features, is_active
) VALUES (
  'family', 'Família', 4, 15, 1, 8, '{"share": true, "lora": true, "stripe": true}'::jsonb, true
)
ON CONFLICT (plan_id) DO UPDATE SET
  max_stories_per_month = EXCLUDED.max_stories_per_month,
  max_characters = EXCLUDED.max_characters,
  features = EXCLUDED.features,
  is_active = true,
  updated_at = now();
