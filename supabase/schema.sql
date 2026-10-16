-- Estúdio Mágico — schema inicial (Fase 1)
-- Projeto alvo: zlzgkivktvnyvehjwcjw
-- NÃO aplicar automaticamente: revisar e rodar manualmente no SQL Editor / migration.
--
-- Inspeção MCP (2026-10-16): a conta autenticada no MCP NÃO tinha permissão
-- no project_id zlzgkivktvnyvehjwcjw (permission error em list_tables /
-- list_extensions / list_migrations / get_project). Só havia acesso a outro
-- projeto fora do escopo — não inspecionado por isolamento.
-- Este SQL assume banco greenfield (Auth + schema public padrão Supabase).

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
CREATE TYPE public.user_role AS ENUM ('parent', 'admin');

CREATE TYPE public.subscription_status AS ENUM (
  'trialing',
  'active',
  'past_due',
  'canceled',
  'incomplete',
  'none'
);

CREATE TYPE public.story_status AS ENUM (
  'draft',
  'generating',
  'ready',
  'failed',
  'archived'
);

CREATE TYPE public.game_type AS ENUM (
  'quiz',
  'memory',
  'word_match',
  'other'
);

-- ---------------------------------------------------------------------------
-- Helpers base (schema privado + trigger updated_at)
-- private.is_admin() vem DEPOIS de public.users (depende da tabela)
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- users — perfil 1:1 com auth.users
-- ---------------------------------------------------------------------------
CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email text,
  full_name text,
  role public.user_role NOT NULL DEFAULT 'parent',
  security_pin text,
  onboarding_completed boolean NOT NULL DEFAULT false,
  stripe_customer_id text UNIQUE,
  subscription_status public.subscription_status NOT NULL DEFAULT 'none',
  subscription_plan_id text,
  avatar_url text,
  locale text NOT NULL DEFAULT 'pt-BR',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_security_pin_format CHECK (
    security_pin IS NULL OR security_pin ~ '^[0-9]{4,6}$'
  )
);

CREATE INDEX users_subscription_status_idx ON public.users (subscription_status);
CREATE INDEX users_role_idx ON public.users (role);

CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Agora que public.users existe:
CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION private.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_admin() TO authenticated;

-- ---------------------------------------------------------------------------
-- children — filhos do responsável (parent)
-- ---------------------------------------------------------------------------
CREATE TABLE public.children (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  display_name text NOT NULL,
  birth_date date,
  pin_code text,
  avatar_url text,
  avatar_model_id text,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT children_display_name_len CHECK (char_length(display_name) BETWEEN 1 AND 80)
);

CREATE INDEX children_parent_id_idx ON public.children (parent_id);

CREATE TRIGGER children_set_updated_at
  BEFORE UPDATE ON public.children
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- characters — personagens reutilizáveis (por criança ou do parent)
-- ---------------------------------------------------------------------------
CREATE TABLE public.characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  child_id uuid REFERENCES public.children (id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  traits jsonb NOT NULL DEFAULT '[]'::jsonb,
  avatar_url text,
  lora_model_id text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT characters_name_len CHECK (char_length(name) BETWEEN 1 AND 80)
);

CREATE INDEX characters_parent_id_idx ON public.characters (parent_id);
CREATE INDEX characters_child_id_idx ON public.characters (child_id);

CREATE TRIGGER characters_set_updated_at
  BEFORE UPDATE ON public.characters
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- story_templates — catálogo cacheável (públicos + custom do parent)
-- ---------------------------------------------------------------------------
CREATE TABLE public.story_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE,
  title text NOT NULL,
  synopsis text,
  age_min smallint,
  age_max smallint,
  locale text NOT NULL DEFAULT 'pt-BR',
  theme_tags text[] NOT NULL DEFAULT '{}',
  prompt_skeleton jsonb NOT NULL DEFAULT '{}'::jsonb,
  cover_image_url text,
  is_public boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT story_templates_age_range CHECK (
    age_min IS NULL OR age_max IS NULL OR age_min <= age_max
  )
);

CREATE INDEX story_templates_public_active_idx
  ON public.story_templates (is_public, is_active, locale)
  WHERE is_public AND is_active;

CREATE INDEX story_templates_theme_tags_gin
  ON public.story_templates USING gin (theme_tags);

CREATE INDEX story_templates_created_by_idx
  ON public.story_templates (created_by);

CREATE TRIGGER story_templates_set_updated_at
  BEFORE UPDATE ON public.story_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- stories
-- ---------------------------------------------------------------------------
CREATE TABLE public.stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES public.children (id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.story_templates (id) ON DELETE SET NULL,
  character_id uuid REFERENCES public.characters (id) ON DELETE SET NULL,
  title text NOT NULL,
  status public.story_status NOT NULL DEFAULT 'draft',
  is_public boolean NOT NULL DEFAULT false,
  share_token uuid UNIQUE DEFAULT gen_random_uuid(),
  text_content jsonb NOT NULL DEFAULT '{}'::jsonb,
  questions_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  cover_image_url text,
  generation_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stories_title_len CHECK (char_length(title) BETWEEN 1 AND 200)
);

CREATE INDEX stories_parent_id_idx ON public.stories (parent_id);
CREATE INDEX stories_child_id_idx ON public.stories (child_id);
CREATE INDEX stories_status_idx ON public.stories (status);
CREATE INDEX stories_share_token_idx ON public.stories (share_token)
  WHERE share_token IS NOT NULL;
CREATE INDEX stories_public_ready_idx
  ON public.stories (is_public, status)
  WHERE is_public AND status = 'ready';

CREATE TRIGGER stories_set_updated_at
  BEFORE UPDATE ON public.stories
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- story_images
-- ---------------------------------------------------------------------------
CREATE TABLE public.story_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.stories (id) ON DELETE CASCADE,
  parent_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  page_index integer NOT NULL DEFAULT 0,
  image_url text NOT NULL,
  alt_text text,
  prompt_used text,
  width integer,
  height integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT story_images_page_index_nonneg CHECK (page_index >= 0),
  CONSTRAINT story_images_story_page_unique UNIQUE (story_id, page_index)
);

CREATE INDEX story_images_story_id_idx ON public.story_images (story_id);
CREATE INDEX story_images_parent_id_idx ON public.story_images (parent_id);

-- ---------------------------------------------------------------------------
-- games — atividades ligadas a uma história (quiz etc.)
-- ---------------------------------------------------------------------------
CREATE TABLE public.games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.stories (id) ON DELETE CASCADE,
  parent_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  child_id uuid REFERENCES public.children (id) ON DELETE SET NULL,
  game_type public.game_type NOT NULL DEFAULT 'quiz',
  title text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  questions_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  score_best integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX games_story_id_idx ON public.games (story_id);
CREATE INDEX games_parent_id_idx ON public.games (parent_id);

CREATE TRIGGER games_set_updated_at
  BEFORE UPDATE ON public.games
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- subscription_limits — limites por plano (seedáveis / cacheáveis)
-- ---------------------------------------------------------------------------
CREATE TABLE public.subscription_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id text NOT NULL UNIQUE,
  plan_name text NOT NULL,
  max_children integer NOT NULL DEFAULT 1,
  max_stories_per_month integer NOT NULL DEFAULT 5,
  max_characters integer NOT NULL DEFAULT 3,
  max_images_per_story integer NOT NULL DEFAULT 8,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscription_limits_nonneg CHECK (
    max_children >= 0
    AND max_stories_per_month >= 0
    AND max_characters >= 0
    AND max_images_per_story >= 0
  )
);

CREATE INDEX subscription_limits_active_idx
  ON public.subscription_limits (is_active)
  WHERE is_active;

CREATE TRIGGER subscription_limits_set_updated_at
  BEFORE UPDATE ON public.subscription_limits
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Seed mínimo de planos (idempotente por plan_id)
INSERT INTO public.subscription_limits (plan_id, plan_name, max_children, max_stories_per_month, max_characters, max_images_per_story, features)
VALUES
  ('free', 'Gratuito', 1, 3, 1, 4, '{"share": true, "lora": false}'::jsonb),
  ('family', 'Família', 4, 30, 8, 12, '{"share": true, "lora": true}'::jsonb)
ON CONFLICT (plan_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Auto-criar perfil em public.users ao registrar em auth.users
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    'parent'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- role vem de public.users.role (NÃO de user_metadata / JWT editável)
-- ---------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_limits ENABLE ROW LEVEL SECURITY;

-- users
CREATE POLICY users_select_own_or_admin
  ON public.users FOR SELECT TO authenticated
  USING (id = auth.uid() OR private.is_admin());

CREATE POLICY users_update_own_or_admin
  ON public.users FOR UPDATE TO authenticated
  USING (id = auth.uid() OR private.is_admin())
  WITH CHECK (id = auth.uid() OR private.is_admin());

CREATE POLICY users_insert_own
  ON public.users FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR private.is_admin());

-- children
CREATE POLICY children_select_own_or_admin
  ON public.children FOR SELECT TO authenticated
  USING (parent_id = auth.uid() OR private.is_admin());

CREATE POLICY children_insert_own_or_admin
  ON public.children FOR INSERT TO authenticated
  WITH CHECK (parent_id = auth.uid() OR private.is_admin());

CREATE POLICY children_update_own_or_admin
  ON public.children FOR UPDATE TO authenticated
  USING (parent_id = auth.uid() OR private.is_admin())
  WITH CHECK (parent_id = auth.uid() OR private.is_admin());

CREATE POLICY children_delete_own_or_admin
  ON public.children FOR DELETE TO authenticated
  USING (parent_id = auth.uid() OR private.is_admin());

-- characters
CREATE POLICY characters_select_own_or_admin
  ON public.characters FOR SELECT TO authenticated
  USING (parent_id = auth.uid() OR private.is_admin());

CREATE POLICY characters_insert_own_or_admin
  ON public.characters FOR INSERT TO authenticated
  WITH CHECK (parent_id = auth.uid() OR private.is_admin());

CREATE POLICY characters_update_own_or_admin
  ON public.characters FOR UPDATE TO authenticated
  USING (parent_id = auth.uid() OR private.is_admin())
  WITH CHECK (parent_id = auth.uid() OR private.is_admin());

CREATE POLICY characters_delete_own_or_admin
  ON public.characters FOR DELETE TO authenticated
  USING (parent_id = auth.uid() OR private.is_admin());

-- story_templates: leitura pública de ativos; escrita admin ou dono do custom
CREATE POLICY story_templates_select_public_or_own
  ON public.story_templates FOR SELECT TO anon, authenticated
  USING (
    (is_public AND is_active)
    OR created_by = auth.uid()
    OR private.is_admin()
  );

CREATE POLICY story_templates_insert_own_or_admin
  ON public.story_templates FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() OR private.is_admin());

CREATE POLICY story_templates_update_own_or_admin
  ON public.story_templates FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR private.is_admin())
  WITH CHECK (created_by = auth.uid() OR private.is_admin());

CREATE POLICY story_templates_delete_own_or_admin
  ON public.story_templates FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR private.is_admin());

-- stories: dono + admin; leitura pública por share_token / is_public
CREATE POLICY stories_select_own_or_admin
  ON public.stories FOR SELECT TO authenticated
  USING (parent_id = auth.uid() OR private.is_admin());

CREATE POLICY stories_select_public_share
  ON public.stories FOR SELECT TO anon, authenticated
  USING (is_public = true AND status = 'ready');

CREATE POLICY stories_insert_own_or_admin
  ON public.stories FOR INSERT TO authenticated
  WITH CHECK (parent_id = auth.uid() OR private.is_admin());

CREATE POLICY stories_update_own_or_admin
  ON public.stories FOR UPDATE TO authenticated
  USING (parent_id = auth.uid() OR private.is_admin())
  WITH CHECK (parent_id = auth.uid() OR private.is_admin());

CREATE POLICY stories_delete_own_or_admin
  ON public.stories FOR DELETE TO authenticated
  USING (parent_id = auth.uid() OR private.is_admin());

-- story_images: dono; leitura se a história for pública
CREATE POLICY story_images_select_own_or_admin
  ON public.story_images FOR SELECT TO authenticated
  USING (parent_id = auth.uid() OR private.is_admin());

CREATE POLICY story_images_select_public_story
  ON public.story_images FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.stories s
      WHERE s.id = story_images.story_id
        AND s.is_public = true
        AND s.status = 'ready'
    )
  );

CREATE POLICY story_images_insert_own_or_admin
  ON public.story_images FOR INSERT TO authenticated
  WITH CHECK (parent_id = auth.uid() OR private.is_admin());

CREATE POLICY story_images_update_own_or_admin
  ON public.story_images FOR UPDATE TO authenticated
  USING (parent_id = auth.uid() OR private.is_admin())
  WITH CHECK (parent_id = auth.uid() OR private.is_admin());

CREATE POLICY story_images_delete_own_or_admin
  ON public.story_images FOR DELETE TO authenticated
  USING (parent_id = auth.uid() OR private.is_admin());

-- games
CREATE POLICY games_select_own_or_admin
  ON public.games FOR SELECT TO authenticated
  USING (parent_id = auth.uid() OR private.is_admin());

CREATE POLICY games_select_public_story
  ON public.games FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.stories s
      WHERE s.id = games.story_id
        AND s.is_public = true
        AND s.status = 'ready'
    )
  );

CREATE POLICY games_insert_own_or_admin
  ON public.games FOR INSERT TO authenticated
  WITH CHECK (parent_id = auth.uid() OR private.is_admin());

CREATE POLICY games_update_own_or_admin
  ON public.games FOR UPDATE TO authenticated
  USING (parent_id = auth.uid() OR private.is_admin())
  WITH CHECK (parent_id = auth.uid() OR private.is_admin());

CREATE POLICY games_delete_own_or_admin
  ON public.games FOR DELETE TO authenticated
  USING (parent_id = auth.uid() OR private.is_admin());

-- subscription_limits: leitura autenticada de planos ativos; escrita só admin
CREATE POLICY subscription_limits_select_active
  ON public.subscription_limits FOR SELECT TO authenticated
  USING (is_active = true OR private.is_admin());

CREATE POLICY subscription_limits_admin_write
  ON public.subscription_limits FOR ALL TO authenticated
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

-- ---------------------------------------------------------------------------
-- Grants básicos (RLS continua filtrando linhas)
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.story_templates TO anon, authenticated;
GRANT SELECT ON public.stories TO anon, authenticated;
GRANT SELECT ON public.story_images TO anon, authenticated;
GRANT SELECT ON public.games TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
