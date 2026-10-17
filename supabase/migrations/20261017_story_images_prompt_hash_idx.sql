-- Acelera lookup de cache por hash de prompt (ph:<hash>|…)
CREATE INDEX IF NOT EXISTS story_images_parent_prompt_idx
  ON public.story_images (parent_id, prompt_used);
