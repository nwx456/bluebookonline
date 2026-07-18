-- Exam Library: personal organization (rename, notes, archive, tags)

ALTER TABLE public.pdf_uploads
  ADD COLUMN IF NOT EXISTS display_title text,
  ADD COLUMN IF NOT EXISTS personal_notes text,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE public.attempts
  ADD COLUMN IF NOT EXISTS display_title text,
  ADD COLUMN IF NOT EXISTS personal_notes text,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE TABLE IF NOT EXISTS public.user_library_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text NOT NULL,
  name text NOT NULL,
  color text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_library_tags_user_email_lower_name
  ON public.user_library_tags (user_email, lower(trim(name)));

CREATE INDEX IF NOT EXISTS user_library_tags_user_email_idx
  ON public.user_library_tags (user_email);

CREATE TABLE IF NOT EXISTS public.user_library_taggings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id uuid NOT NULL REFERENCES public.user_library_tags(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('upload', 'attempt')),
  entity_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tag_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS user_library_taggings_entity_idx
  ON public.user_library_taggings (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS user_library_taggings_tag_id_idx
  ON public.user_library_taggings (tag_id);

ALTER TABLE public.user_library_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_library_taggings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "no_anon_authed_access" ON public.user_library_tags
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "no_anon_authed_access" ON public.user_library_taggings
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);
