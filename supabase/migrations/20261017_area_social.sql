-- Área Social Euzim — visibility + amizades + convites + likes
-- Projeto: zlzgkivktvnyvehjwcjw only

-- ---------------------------------------------------------------------------
-- stories.visibility (private | friends | public); is_public permanece derivado
-- ---------------------------------------------------------------------------
ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stories_visibility_check'
  ) THEN
    ALTER TABLE public.stories
      ADD CONSTRAINT stories_visibility_check
      CHECK (visibility IN ('private', 'friends', 'public'));
  END IF;
END $$;

UPDATE public.stories
SET visibility = CASE WHEN is_public THEN 'public' ELSE 'private' END
WHERE visibility IS DISTINCT FROM CASE WHEN is_public THEN 'public' ELSE 'private' END;

CREATE OR REPLACE FUNCTION public.sync_story_is_public_from_visibility()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.is_public := (NEW.visibility = 'public');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stories_sync_is_public ON public.stories;
CREATE TRIGGER stories_sync_is_public
  BEFORE INSERT OR UPDATE OF visibility ON public.stories
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_story_is_public_from_visibility();

CREATE INDEX IF NOT EXISTS stories_visibility_ready_idx
  ON public.stories (visibility, status)
  WHERE status = 'ready' AND visibility IN ('friends', 'public');

-- ---------------------------------------------------------------------------
-- friendships — entre contas parent (users.id)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT friendships_not_self CHECK (requester_id <> addressee_id),
  CONSTRAINT friendships_pair_unique UNIQUE (requester_id, addressee_id)
);

CREATE INDEX IF NOT EXISTS friendships_requester_idx
  ON public.friendships (requester_id, status);
CREATE INDEX IF NOT EXISTS friendships_addressee_idx
  ON public.friendships (addressee_id, status);

DROP TRIGGER IF EXISTS friendships_set_updated_at ON public.friendships;
CREATE TRIGGER friendships_set_updated_at
  BEFORE UPDATE ON public.friendships
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS friendships_select_involved ON public.friendships;
CREATE POLICY friendships_select_involved
  ON public.friendships FOR SELECT TO authenticated
  USING (
    requester_id = auth.uid()
    OR addressee_id = auth.uid()
    OR private.is_admin()
  );

DROP POLICY IF EXISTS friendships_insert_requester ON public.friendships;
CREATE POLICY friendships_insert_requester
  ON public.friendships FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid() OR private.is_admin());

DROP POLICY IF EXISTS friendships_update_involved ON public.friendships;
CREATE POLICY friendships_update_involved
  ON public.friendships FOR UPDATE TO authenticated
  USING (
    requester_id = auth.uid()
    OR addressee_id = auth.uid()
    OR private.is_admin()
  )
  WITH CHECK (
    requester_id = auth.uid()
    OR addressee_id = auth.uid()
    OR private.is_admin()
  );

DROP POLICY IF EXISTS friendships_delete_involved ON public.friendships;
CREATE POLICY friendships_delete_involved
  ON public.friendships FOR DELETE TO authenticated
  USING (
    requester_id = auth.uid()
    OR addressee_id = auth.uid()
    OR private.is_admin()
  );

-- ---------------------------------------------------------------------------
-- friend_invites — link /invite/[token]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.friend_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  inviter_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  accepted_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS friend_invites_inviter_idx
  ON public.friend_invites (inviter_id, status);
CREATE INDEX IF NOT EXISTS friend_invites_token_idx
  ON public.friend_invites (token)
  WHERE status = 'pending';

DROP TRIGGER IF EXISTS friend_invites_set_updated_at ON public.friend_invites;
CREATE TRIGGER friend_invites_set_updated_at
  BEFORE UPDATE ON public.friend_invites
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.friend_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS friend_invites_select_own_or_auth ON public.friend_invites;
CREATE POLICY friend_invites_select_own_or_auth
  ON public.friend_invites FOR SELECT TO authenticated
  USING (
    inviter_id = auth.uid()
    OR status = 'pending'
    OR private.is_admin()
  );

DROP POLICY IF EXISTS friend_invites_insert_own ON public.friend_invites;
CREATE POLICY friend_invites_insert_own
  ON public.friend_invites FOR INSERT TO authenticated
  WITH CHECK (inviter_id = auth.uid() OR private.is_admin());

DROP POLICY IF EXISTS friend_invites_update_auth ON public.friend_invites;
CREATE POLICY friend_invites_update_auth
  ON public.friend_invites FOR UPDATE TO authenticated
  USING (
    inviter_id = auth.uid()
    OR status = 'pending'
    OR private.is_admin()
  )
  WITH CHECK (
    inviter_id = auth.uid()
    OR private.is_admin()
    OR accepted_by = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- story_likes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.story_likes (
  story_id uuid NOT NULL REFERENCES public.stories (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, user_id)
);

CREATE INDEX IF NOT EXISTS story_likes_user_idx
  ON public.story_likes (user_id);

ALTER TABLE public.story_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS story_likes_select_auth ON public.story_likes;
CREATE POLICY story_likes_select_auth
  ON public.story_likes FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS story_likes_insert_own ON public.story_likes;
CREATE POLICY story_likes_insert_own
  ON public.story_likes FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.stories s
      WHERE s.id = story_id
        AND s.status = 'ready'
        AND (
          s.parent_id = auth.uid()
          OR s.visibility = 'public'
          OR (
            s.visibility = 'friends'
            AND EXISTS (
              SELECT 1
              FROM public.friendships f
              WHERE f.status = 'accepted'
                AND (
                  (f.requester_id = auth.uid() AND f.addressee_id = s.parent_id)
                  OR (f.addressee_id = auth.uid() AND f.requester_id = s.parent_id)
                )
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS story_likes_delete_own ON public.story_likes;
CREATE POLICY story_likes_delete_own
  ON public.story_likes FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR private.is_admin());

-- ---------------------------------------------------------------------------
-- Helper: amizade aceita entre dois users
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.are_friends(a uuid, b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.friendships f
    WHERE f.status = 'accepted'
      AND (
        (f.requester_id = a AND f.addressee_id = b)
        OR (f.requester_id = b AND f.addressee_id = a)
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS stories: feed friends + public (mantém share legado via is_public)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS stories_select_public_share ON public.stories;
CREATE POLICY stories_select_public_share
  ON public.stories FOR SELECT TO anon, authenticated
  USING (
    status = 'ready'
    AND (
      visibility = 'public'
      OR is_public = true
    )
  );

DROP POLICY IF EXISTS stories_select_friends_feed ON public.stories;
CREATE POLICY stories_select_friends_feed
  ON public.stories FOR SELECT TO authenticated
  USING (
    status = 'ready'
    AND visibility = 'friends'
    AND private.are_friends(auth.uid(), parent_id)
  );

DROP POLICY IF EXISTS story_images_select_public_story ON public.story_images;
CREATE POLICY story_images_select_public_story
  ON public.story_images FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.stories s
      WHERE s.id = story_images.story_id
        AND s.status = 'ready'
        AND (s.visibility = 'public' OR s.is_public = true)
    )
  );

DROP POLICY IF EXISTS story_images_select_friends_story ON public.story_images;
CREATE POLICY story_images_select_friends_story
  ON public.story_images FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.stories s
      WHERE s.id = story_images.story_id
        AND s.status = 'ready'
        AND s.visibility = 'friends'
        AND private.are_friends(auth.uid(), s.parent_id)
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.friend_invites TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.story_likes TO authenticated;
