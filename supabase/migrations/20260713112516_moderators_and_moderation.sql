-- Moderator roles and exam publication moderation workflow.

CREATE TABLE IF NOT EXISTS public.moderators (
  email text PRIMARY KEY,
  added_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_moderators_active ON public.moderators(active) WHERE active = true;

ALTER TABLE public.moderators ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'moderators' AND policyname = 'no_anon_authed_access'
  ) THEN
    CREATE POLICY "no_anon_authed_access" ON public.moderators
      FOR ALL TO anon, authenticated
      USING (false)
      WITH CHECK (false);
  END IF;
END $$;

-- Moderation columns on pdf_uploads
ALTER TABLE public.pdf_uploads
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'draft'
    CHECK (moderation_status IN ('draft', 'pending_review', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS publish_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS moderated_at timestamptz,
  ADD COLUMN IF NOT EXISTS moderated_by text;

CREATE INDEX IF NOT EXISTS idx_pdf_uploads_moderation_status
  ON public.pdf_uploads(moderation_status);

CREATE INDEX IF NOT EXISTS idx_pdf_uploads_pending_review
  ON public.pdf_uploads(publish_requested_at)
  WHERE moderation_status = 'pending_review';

-- Backfill existing rows
UPDATE public.pdf_uploads
SET moderation_status = CASE
  WHEN is_published = true THEN 'approved'
  ELSE 'draft'
END
WHERE moderation_status = 'draft';
