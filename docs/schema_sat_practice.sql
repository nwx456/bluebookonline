-- =============================================================================
-- SAT Practice Mode migration
-- Adds program-aware columns to support Digital SAT alongside existing AP.
-- Backwards-compatible: all new columns are NULL/default for existing AP rows.
-- Run in Supabase SQL editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- pdf_uploads: which program + SAT-specific upload configuration
-- -----------------------------------------------------------------------------
ALTER TABLE pdf_uploads
  ADD COLUMN IF NOT EXISTS exam_program text DEFAULT 'AP';

ALTER TABLE pdf_uploads
  ADD COLUMN IF NOT EXISTS sat_format text NULL;
-- sat_format: 'single_module' | 'full_test'

ALTER TABLE pdf_uploads
  ADD COLUMN IF NOT EXISTS sat_adaptive_mode text NULL;
-- sat_adaptive_mode: 'none' | 'six_module' (legacy 'pool' treated as 'none')

ALTER TABLE pdf_uploads
  ADD COLUMN IF NOT EXISTS sat_cutoff_rw integer NULL;

ALTER TABLE pdf_uploads
  ADD COLUMN IF NOT EXISTS sat_cutoff_math integer NULL;

-- Backfill exam_program for any existing rows (treat all legacy rows as AP).
UPDATE pdf_uploads
SET exam_program = 'AP'
WHERE exam_program IS NULL;

-- -----------------------------------------------------------------------------
-- questions: SAT section/module/variant/difficulty + question_type for grid-in
-- -----------------------------------------------------------------------------
ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS sat_section text NULL;
-- sat_section: 'rw' | 'math' (NULL for AP)

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS sat_module integer NULL;
-- sat_module: 1 | 2 (NULL for AP / single-module SAT)

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS sat_module_variant text NULL;
-- sat_module_variant: 'easy' | 'hard' (only for six_module adaptive)

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS sat_pdf_module_label text NULL;
-- Original PDF module heading (e.g. "Module A", "Module B")

ALTER TABLE pdf_uploads
  ADD COLUMN IF NOT EXISTS sat_structure_detected jsonb NULL;
-- AI discovery pass: detected module titles and suggested adaptive mode

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS sat_difficulty text NULL;
-- sat_difficulty: 'easy' | 'medium' | 'hard' (reserved; generally null)

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS question_type text DEFAULT 'mcq';
-- question_type: 'mcq' | 'grid_in'

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS accepted_answers jsonb NULL;
-- accepted_answers: array of equivalent string answers for grid-in, e.g. ["3/2","1.5"]

-- Grid-in correct_answer must allow numeric strings (see migration
-- supabase/migrations/20260527000000_questions_grid_in_correct_answer.sql):
-- MCQ -> A-E; grid_in -> numeric pattern; null always allowed.

-- -----------------------------------------------------------------------------
-- attempts: module progress + scaled scores for SAT
-- -----------------------------------------------------------------------------
ALTER TABLE attempts
  ADD COLUMN IF NOT EXISTS current_module_index integer DEFAULT 0;
-- 0=rw1, 1=rw2, 2=math1, 3=math2 (NULL/0 for AP)

ALTER TABLE attempts
  ADD COLUMN IF NOT EXISTS module_progress jsonb NULL;
-- { "rw1": {"time":120,"correct":18,"total":27}, ... }

ALTER TABLE attempts
  ADD COLUMN IF NOT EXISTS rw_scaled_score integer NULL;

ALTER TABLE attempts
  ADD COLUMN IF NOT EXISTS math_scaled_score integer NULL;

ALTER TABLE attempts
  ADD COLUMN IF NOT EXISTS total_scaled_score integer NULL;

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_pdf_uploads_program_published
  ON pdf_uploads (exam_program, is_published, created_at DESC)
  WHERE is_published = true;

CREATE INDEX IF NOT EXISTS idx_questions_upload_section_module
  ON questions (upload_id, sat_section, sat_module);
