-- FRQ library parity: org fields, publish/moderation, source attribution, tagging, reports.

-- Library + publish + source on frq_uploads
ALTER TABLE public.frq_uploads
  ADD COLUMN IF NOT EXISTS display_title text,
  ADD COLUMN IF NOT EXISTS personal_notes text,
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'draft'
    CHECK (moderation_status IN ('draft', 'pending_review', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS publish_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS moderated_at timestamptz,
  ADD COLUMN IF NOT EXISTS moderated_by text,
  ADD COLUMN IF NOT EXISTS source_type text
    CHECK (source_type IS NULL OR source_type IN ('book', 'agency', 'school')),
  ADD COLUMN IF NOT EXISTS source_name text,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS not_official_material_confirmed boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_frq_uploads_moderation_status
  ON public.frq_uploads(moderation_status);

CREATE INDEX IF NOT EXISTS idx_frq_uploads_pending_review
  ON public.frq_uploads(publish_requested_at)
  WHERE moderation_status = 'pending_review';

-- Library org on frq_attempts
ALTER TABLE public.frq_attempts
  ADD COLUMN IF NOT EXISTS display_title text,
  ADD COLUMN IF NOT EXISTS personal_notes text,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_frq_attempts_archived_at
  ON public.frq_attempts(archived_at);

-- Extend taggings entity types
ALTER TABLE public.user_library_taggings
  DROP CONSTRAINT IF EXISTS user_library_taggings_entity_type_check;

ALTER TABLE public.user_library_taggings
  ADD CONSTRAINT user_library_taggings_entity_type_check
  CHECK (entity_type IN ('upload', 'attempt', 'frq_upload', 'frq_attempt'));

-- Extend question_reports for FRQ
ALTER TABLE public.question_reports
  ADD COLUMN IF NOT EXISTS exam_kind text NOT NULL DEFAULT 'mcq'
    CHECK (exam_kind IN ('mcq', 'frq')),
  ADD COLUMN IF NOT EXISTS frq_question_id uuid REFERENCES public.frq_questions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS frq_upload_id uuid REFERENCES public.frq_uploads(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS frq_attempt_id uuid REFERENCES public.frq_attempts(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS part_label text;

ALTER TABLE public.question_reports
  ALTER COLUMN question_id DROP NOT NULL,
  ALTER COLUMN upload_id DROP NOT NULL,
  ALTER COLUMN attempt_id DROP NOT NULL;

ALTER TABLE public.question_reports
  DROP CONSTRAINT IF EXISTS question_reports_exam_refs_check;

ALTER TABLE public.question_reports
  ADD CONSTRAINT question_reports_exam_refs_check CHECK (
    (exam_kind = 'mcq' AND question_id IS NOT NULL AND upload_id IS NOT NULL AND attempt_id IS NOT NULL)
    OR
    (exam_kind = 'frq' AND frq_question_id IS NOT NULL AND frq_upload_id IS NOT NULL AND frq_attempt_id IS NOT NULL)
  );

DROP INDEX IF EXISTS idx_question_reports_user_question_attempt;

CREATE UNIQUE INDEX IF NOT EXISTS idx_question_reports_user_mcq_attempt
  ON public.question_reports (user_email, question_id, attempt_id)
  WHERE exam_kind = 'mcq';

CREATE UNIQUE INDEX IF NOT EXISTS idx_question_reports_user_frq_part_attempt
  ON public.question_reports (user_email, frq_question_id, frq_attempt_id, COALESCE(part_label, ''))
  WHERE exam_kind = 'frq';

CREATE INDEX IF NOT EXISTS idx_question_reports_frq_upload_id
  ON public.question_reports (frq_upload_id)
  WHERE frq_upload_id IS NOT NULL;
