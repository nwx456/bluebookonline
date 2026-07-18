-- FRQ exam module (parallel to MCQ; does not modify existing exam tables).

CREATE TABLE IF NOT EXISTS public.frq_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text NOT NULL REFERENCES public.usertable(email) ON DELETE CASCADE,
  course_id text NOT NULL,
  title text NOT NULL,
  storage_path text NOT NULL,
  rubric_storage_path text,
  status text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'ready', 'failed')),
  section_duration_min integer,
  question_count integer NOT NULL DEFAULT 0,
  max_score integer NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_frq_uploads_user_email ON public.frq_uploads(user_email);
CREATE INDEX IF NOT EXISTS idx_frq_uploads_course_id ON public.frq_uploads(course_id);
CREATE INDEX IF NOT EXISTS idx_frq_uploads_status ON public.frq_uploads(status);

CREATE TABLE IF NOT EXISTS public.frq_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  frq_upload_id uuid NOT NULL REFERENCES public.frq_uploads(id) ON DELETE CASCADE,
  question_number integer NOT NULL,
  question_type text NOT NULL DEFAULT 'generic'
    CHECK (question_type IN ('essay', 'saq', 'dbq', 'leq', 'code', 'generic', 'aaq', 'ebq')),
  prompt_html text NOT NULL DEFAULT '',
  stimulus_html text,
  parts jsonb NOT NULL DEFAULT '[]'::jsonb,
  max_points integer NOT NULL DEFAULT 0,
  scoring_guidelines jsonb,
  page_refs jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (frq_upload_id, question_number)
);

CREATE INDEX IF NOT EXISTS idx_frq_questions_upload_id ON public.frq_questions(frq_upload_id);

CREATE TABLE IF NOT EXISTS public.frq_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text NOT NULL REFERENCES public.usertable(email) ON DELETE CASCADE,
  frq_upload_id uuid NOT NULL REFERENCES public.frq_uploads(id) ON DELETE CASCADE,
  assignment_id uuid REFERENCES public.class_assignments(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed', 'grading', 'graded')),
  total_score numeric(8,2),
  max_score numeric(8,2),
  is_late boolean NOT NULL DEFAULT false,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  graded_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_frq_attempts_user_email ON public.frq_attempts(user_email);
CREATE INDEX IF NOT EXISTS idx_frq_attempts_upload_id ON public.frq_attempts(frq_upload_id);
CREATE INDEX IF NOT EXISTS idx_frq_attempts_assignment_id ON public.frq_attempts(assignment_id);

CREATE TABLE IF NOT EXISTS public.frq_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.frq_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.frq_questions(id) ON DELETE CASCADE,
  part_label text NOT NULL DEFAULT '',
  response_text text NOT NULL DEFAULT '',
  is_flagged boolean NOT NULL DEFAULT false,
  score numeric(8,2),
  rubric_breakdown jsonb,
  ai_feedback text,
  graded_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, question_id, part_label)
);

CREATE INDEX IF NOT EXISTS idx_frq_responses_attempt_id ON public.frq_responses(attempt_id);
CREATE INDEX IF NOT EXISTS idx_frq_responses_question_id ON public.frq_responses(question_id);

-- Extend class_assignments for FRQ exams (additive).
ALTER TABLE public.class_assignments
  ADD COLUMN IF NOT EXISTS frq_upload_id uuid REFERENCES public.frq_uploads(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_class_assignments_frq_upload_id
  ON public.class_assignments(frq_upload_id);

ALTER TABLE public.class_assignments DROP CONSTRAINT IF EXISTS class_assignments_kind_check;
ALTER TABLE public.class_assignments ADD CONSTRAINT class_assignments_kind_check
  CHECK (kind IN ('exam', 'resource', 'frq_exam'));

ALTER TABLE public.class_assignments DROP CONSTRAINT IF EXISTS class_assignments_check;
ALTER TABLE public.class_assignments ADD CONSTRAINT class_assignments_check CHECK (
  (kind = 'exam' AND upload_id IS NOT NULL AND resource_id IS NULL AND frq_upload_id IS NULL)
  OR (kind = 'resource' AND resource_id IS NOT NULL AND upload_id IS NULL AND frq_upload_id IS NULL)
  OR (kind = 'frq_exam' AND frq_upload_id IS NOT NULL AND upload_id IS NULL AND resource_id IS NULL)
);

-- RLS deny-all (service role API access only)
ALTER TABLE public.frq_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frq_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frq_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frq_responses ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['frq_uploads', 'frq_questions', 'frq_attempts', 'frq_responses']
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

-- Reuse pdf_uploads bucket with frq/ prefix (no new bucket required)
