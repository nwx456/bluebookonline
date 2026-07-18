-- Teacher role, class management, assignments, and teacher resources.

-- Role column (existing users default to STUDENT)
ALTER TABLE public.usertable
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'STUDENT'
    CHECK (role IN ('STUDENT', 'TEACHER'));

ALTER TABLE public.pending_registrations
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'STUDENT'
    CHECK (role IN ('STUDENT', 'TEACHER'));

CREATE INDEX IF NOT EXISTS idx_usertable_role ON public.usertable(role);

-- Classes (teacher 1-N)
CREATE TABLE IF NOT EXISTS public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_email text NOT NULL REFERENCES public.usertable(email) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  class_code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_classes_teacher_email ON public.classes(teacher_email);
CREATE INDEX IF NOT EXISTS idx_classes_class_code ON public.classes(class_code);

-- Student membership (M-N)
CREATE TABLE IF NOT EXISTS public.class_members (
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_email text NOT NULL REFERENCES public.usertable(email) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (class_id, student_email)
);

CREATE INDEX IF NOT EXISTS idx_class_members_student_email ON public.class_members(student_email);

-- Teacher resources (PDF/doc/link)
CREATE TABLE IF NOT EXISTS public.teacher_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_email text NOT NULL REFERENCES public.usertable(email) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  resource_type text NOT NULL CHECK (resource_type IN ('file', 'link')),
  storage_path text,
  file_name text,
  file_size bigint,
  mime_type text,
  external_url text,
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  moderation_status text NOT NULL DEFAULT 'draft'
    CHECK (moderation_status IN ('draft', 'pending_review', 'approved', 'rejected')),
  moderated_at timestamptz,
  moderated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_teacher_resources_teacher_email ON public.teacher_resources(teacher_email);
CREATE INDEX IF NOT EXISTS idx_teacher_resources_pending_review
  ON public.teacher_resources(created_at)
  WHERE moderation_status = 'pending_review';

-- Class assignments (exam or resource)
CREATE TABLE IF NOT EXISTS public.class_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  assigned_by text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('exam', 'resource')),
  upload_id uuid REFERENCES public.pdf_uploads(id) ON DELETE CASCADE,
  resource_id uuid REFERENCES public.teacher_resources(id) ON DELETE CASCADE,
  due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  CHECK (
    (kind = 'exam' AND upload_id IS NOT NULL AND resource_id IS NULL)
    OR (kind = 'resource' AND resource_id IS NOT NULL AND upload_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_class_assignments_class_id ON public.class_assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_class_assignments_upload_id ON public.class_assignments(upload_id);
CREATE INDEX IF NOT EXISTS idx_class_assignments_resource_id ON public.class_assignments(resource_id);

-- Attempts: assignment link + late flag
ALTER TABLE public.attempts
  ADD COLUMN IF NOT EXISTS assignment_id uuid REFERENCES public.class_assignments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_late boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_attempts_assignment_id ON public.attempts(assignment_id);

-- RLS deny-all (service role API access only)
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_assignments ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['classes', 'class_members', 'teacher_resources', 'class_assignments']
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

-- Private bucket for class resource files (created via Supabase dashboard/CLI if missing)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('class-resources', 'class-resources', false, 52428800)
ON CONFLICT (id) DO NOTHING;
