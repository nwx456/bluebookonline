-- Notes-to-exam generator: stored explanations and upload metadata.

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS explanation text;

ALTER TABLE public.pdf_uploads
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'pdf_extract',
  ADD COLUMN IF NOT EXISTS generated_topic text,
  ADD COLUMN IF NOT EXISTS generated_difficulty text;

COMMENT ON COLUMN public.questions.explanation IS 'AI-generated answer explanation saved at exam creation time (notes generator).';
COMMENT ON COLUMN public.pdf_uploads.origin IS 'Upload origin: pdf_extract (default) or notes_generated.';
COMMENT ON COLUMN public.pdf_uploads.generated_topic IS 'User-provided or AI-derived unit/topic title for notes-generated exams.';
COMMENT ON COLUMN public.pdf_uploads.generated_difficulty IS 'Requested difficulty preset: easy, medium, or hard.';
