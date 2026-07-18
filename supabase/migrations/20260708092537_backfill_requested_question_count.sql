-- One-time backfill for legacy pdf_uploads rows (already applied on remote).
-- Kept locally so Supabase CLI migration history matches production.

UPDATE public.pdf_uploads
SET requested_question_count = requested_question_count
WHERE false;
