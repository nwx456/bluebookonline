-- Multi-tenant institution management: INSTITUTION role, institutions, teacher memberships, class linkage.

-- Extend role enum on usertable and pending_registrations
DO $$
DECLARE
  con record;
BEGIN
  FOR con IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'usertable'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) LIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE public.usertable DROP CONSTRAINT IF EXISTS %I', con.conname);
  END LOOP;

  FOR con IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'pending_registrations'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) LIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE public.pending_registrations DROP CONSTRAINT IF EXISTS %I', con.conname);
  END LOOP;
END $$;

ALTER TABLE public.usertable
  ADD CONSTRAINT usertable_role_check
    CHECK (role IN ('STUDENT', 'TEACHER', 'INSTITUTION'));

ALTER TABLE public.pending_registrations
  ADD CONSTRAINT pending_registrations_role_check
    CHECK (role IN ('STUDENT', 'TEACHER', 'INSTITUTION'));

-- Institution accounts (1:1 with usertable owner_email where role = INSTITUTION)
CREATE TABLE IF NOT EXISTS public.institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email text NOT NULL UNIQUE REFERENCES public.usertable(email) ON DELETE CASCADE,
  name text NOT NULL,
  join_code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_institutions_join_code ON public.institutions(join_code);
CREATE INDEX IF NOT EXISTS idx_institutions_status ON public.institutions(status);

-- Teacher membership in institutions (approval workflow)
CREATE TABLE IF NOT EXISTS public.institution_teachers (
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  teacher_email text NOT NULL REFERENCES public.usertable(email) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'removed')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  removed_at timestamptz,
  PRIMARY KEY (institution_id, teacher_email)
);

CREATE INDEX IF NOT EXISTS idx_institution_teachers_teacher_email
  ON public.institution_teachers(teacher_email);
CREATE INDEX IF NOT EXISTS idx_institution_teachers_status
  ON public.institution_teachers(institution_id, status);

-- Link classes to institutions (NULL = independent)
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES public.institutions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_classes_institution_id ON public.classes(institution_id);

-- RLS deny-all (service role API access only)
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institution_teachers ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['institutions', 'institution_teachers']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl AND policyname = 'no_anon_authed_access'
    ) THEN
      EXECUTE format(
        'CREATE POLICY "no_anon_authed_access" ON public.%I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
        tbl
      );
    END IF;
  END LOOP;
END $$;
