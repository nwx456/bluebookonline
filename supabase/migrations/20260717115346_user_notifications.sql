-- In-app notifications and moderator report action audit log.

CREATE TABLE IF NOT EXISTS public.user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text NOT NULL,
  type text NOT NULL DEFAULT 'report_resolved',
  title text NOT NULL,
  body text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_read_created
  ON public.user_notifications (user_email, read_at NULLS FIRST, created_at DESC);

CREATE TABLE IF NOT EXISTS public.question_report_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('dismiss', 'delete', 'notify')),
  moderator_email text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_question_report_actions_question_id
  ON public.question_report_actions (question_id, created_at DESC);

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_report_actions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_notifications'
      AND policyname = 'no_anon_authed_access'
  ) THEN
    CREATE POLICY "no_anon_authed_access" ON public.user_notifications
      FOR ALL TO anon, authenticated
      USING (false)
      WITH CHECK (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'question_report_actions'
      AND policyname = 'no_anon_authed_access'
  ) THEN
    CREATE POLICY "no_anon_authed_access" ON public.question_report_actions
      FOR ALL TO anon, authenticated
      USING (false)
      WITH CHECK (false);
  END IF;
END $$;
