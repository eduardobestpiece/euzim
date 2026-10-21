-- Feedback por página da história (joinha / não gostei) + aprendizado
-- Projeto OBRIGATÓRIO: zlzgkivktvnyvehjwcjw
-- NÃO aplicar em Best Piece (hpjqetugksblfiojwhzh) nem em qualquer outro projeto.
-- Como aplicar: SQL Editor do Supabase do projeto zlzgkivktvnyvehjwcjw → colar → Run
-- Espelho em docs: docs/story-page-feedback-migration.sql

-- ---------------------------------------------------------------------------
-- story_page_feedback — voto e comentário por página (1 voto atual por usuário)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.story_page_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.stories (id) ON DELETE CASCADE,
  parent_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  page_index integer NOT NULL DEFAULT 0,
  rating text NOT NULL CHECK (rating IN ('like', 'dislike')),
  comment text,
  image_url text,
  prompt_snippet text,
  requested_regenerate boolean NOT NULL DEFAULT false,
  regenerated_image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT story_page_feedback_page_index_nonneg CHECK (page_index >= 0),
  CONSTRAINT story_page_feedback_comment_len CHECK (
    comment IS NULL OR char_length(comment) BETWEEN 1 AND 1200
  ),
  CONSTRAINT story_page_feedback_story_user_page_unique
    UNIQUE (story_id, parent_id, page_index)
);

CREATE INDEX IF NOT EXISTS story_page_feedback_story_idx
  ON public.story_page_feedback (story_id);

CREATE INDEX IF NOT EXISTS story_page_feedback_parent_idx
  ON public.story_page_feedback (parent_id, created_at DESC);

CREATE INDEX IF NOT EXISTS story_page_feedback_dislike_learning_idx
  ON public.story_page_feedback (rating, created_at DESC)
  WHERE rating = 'dislike' AND comment IS NOT NULL;

CREATE OR REPLACE FUNCTION public.story_page_feedback_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS story_page_feedback_set_updated_at
  ON public.story_page_feedback;
CREATE TRIGGER story_page_feedback_set_updated_at
  BEFORE UPDATE ON public.story_page_feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.story_page_feedback_set_updated_at();

ALTER TABLE public.story_page_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS story_page_feedback_select_own ON public.story_page_feedback;
CREATE POLICY story_page_feedback_select_own
  ON public.story_page_feedback FOR SELECT TO authenticated
  USING (parent_id = auth.uid() OR private.is_admin());

DROP POLICY IF EXISTS story_page_feedback_insert_own ON public.story_page_feedback;
CREATE POLICY story_page_feedback_insert_own
  ON public.story_page_feedback FOR INSERT TO authenticated
  WITH CHECK (
    parent_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.stories s
      WHERE s.id = story_id
        AND s.parent_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS story_page_feedback_update_own ON public.story_page_feedback;
CREATE POLICY story_page_feedback_update_own
  ON public.story_page_feedback FOR UPDATE TO authenticated
  USING (parent_id = auth.uid() OR private.is_admin())
  WITH CHECK (parent_id = auth.uid() OR private.is_admin());

DROP POLICY IF EXISTS story_page_feedback_delete_own ON public.story_page_feedback;
CREATE POLICY story_page_feedback_delete_own
  ON public.story_page_feedback FOR DELETE TO authenticated
  USING (parent_id = auth.uid() OR private.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.story_page_feedback TO authenticated;
