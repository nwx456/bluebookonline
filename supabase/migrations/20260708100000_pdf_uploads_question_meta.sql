-- Snapshot fields for admin PDF review (requested vs extracted, answer key source at upload).
ALTER TABLE pdf_uploads
  ADD COLUMN IF NOT EXISTS requested_question_count INT,
  ADD COLUMN IF NOT EXISTS answer_key_from_pdf_count INT;

COMMENT ON COLUMN pdf_uploads.requested_question_count IS 'Question count entered by user at upload time.';
COMMENT ON COLUMN pdf_uploads.answer_key_from_pdf_count IS 'Questions with correct_answer from PDF extraction at upload (before AI grading).';
