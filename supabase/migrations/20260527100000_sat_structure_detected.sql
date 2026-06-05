-- SAT structure metadata for adaptive PDF extraction.

ALTER TABLE pdf_uploads
  ADD COLUMN IF NOT EXISTS sat_structure_detected jsonb NULL;

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS sat_pdf_module_label text NULL;
