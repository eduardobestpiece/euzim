-- Link usage_events to story generation (full cost attribution)
ALTER TABLE public.usage_events
  ADD COLUMN IF NOT EXISTS story_id uuid REFERENCES public.stories (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS job_id uuid REFERENCES public.story_jobs (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS usage_events_story_id_idx
  ON public.usage_events (story_id)
  WHERE story_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS usage_events_job_id_idx
  ON public.usage_events (job_id)
  WHERE job_id IS NOT NULL;
