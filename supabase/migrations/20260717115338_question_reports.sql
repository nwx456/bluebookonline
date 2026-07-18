-- Question reporting: reasons lookup, user reports, pre-delete snapshots.

CREATE TABLE IF NOT EXISTS public.question_report_reasons (
  code text PRIMARY KEY,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true
);

INSERT INTO public.question_report_reasons (code, label, sort_order) VALUES
  ('show_page_broken', 'Show page button did not work', 10),
  ('wrong_correct_answer', 'Correct answer appears to be wrong', 20),
  ('question_text_error', 'Question text is unclear or contains errors', 30),
  ('choices_missing_or_wrong', 'Answer choices are missing or incorrect', 40),
  ('visual_did_not_load', 'Graph, image, or table did not load', 50),
  ('code_render_issue', 'Code snippet did not render properly', 60),
  ('math_notation_issue', 'Math notation displays incorrectly', 70),
  ('other', 'Other', 80)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.question_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL,
  upload_id uuid NOT NULL,
  attempt_id uuid NOT NULL,
  user_email text NOT NULL,
  reason_codes text[] NOT NULL DEFAULT '{}',
  custom_note text,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'dismissed', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT question_reports_custom_note_len CHECK (
    custom_note IS NULL OR char_length(custom_note) <= 500
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_question_reports_user_question_attempt
  ON public.question_reports (user_email, question_id, attempt_id);

CREATE INDEX IF NOT EXISTS idx_question_reports_question_status
  ON public.question_reports (question_id, status);

CREATE INDEX IF NOT EXISTS idx_question_reports_upload_id
  ON public.question_reports (upload_id);

CREATE INDEX IF NOT EXISTS idx_question_reports_user_created
  ON public.question_reports (user_email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_question_reports_status_updated
  ON public.question_reports (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.question_report_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL,
  upload_id uuid NOT NULL,
  snapshot jsonb NOT NULL,
  deleted_by text NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  report_count_at_delete integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_question_report_snapshots_question_id
  ON public.question_report_snapshots (question_id);

CREATE INDEX IF NOT EXISTS idx_question_report_snapshots_upload_id
  ON public.question_report_snapshots (upload_id);

ALTER TABLE public.question_report_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_report_snapshots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'question_report_reasons'
      AND policyname = 'no_anon_authed_access'
  ) THEN
    CREATE POLICY "no_anon_authed_access" ON public.question_report_reasons
      FOR ALL TO anon, authenticated
      USING (false)
      WITH CHECK (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'question_reports'
      AND policyname = 'no_anon_authed_access'
  ) THEN
    CREATE POLICY "no_anon_authed_access" ON public.question_reports
      FOR ALL TO anon, authenticated
      USING (false)
      WITH CHECK (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'question_report_snapshots'
      AND policyname = 'no_anon_authed_access'
  ) THEN
    CREATE POLICY "no_anon_authed_access" ON public.question_report_snapshots
      FOR ALL TO anon, authenticated
      USING (false)
      WITH CHECK (false);
  END IF;
END $$;
