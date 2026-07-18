-- Exam source attribution for upload copyright compliance.

ALTER TABLE public.pdf_uploads
  ADD COLUMN IF NOT EXISTS source_type text
    CHECK (source_type IS NULL OR source_type IN ('book', 'agency', 'school')),
  ADD COLUMN IF NOT EXISTS source_name text,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS not_official_material_confirmed boolean NOT NULL DEFAULT false;
