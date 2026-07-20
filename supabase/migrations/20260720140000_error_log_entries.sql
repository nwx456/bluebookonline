-- Centralized error logging (deduplicated by fingerprint)

CREATE TABLE IF NOT EXISTS public.error_log_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text NOT NULL UNIQUE,
  source text NOT NULL,
  error_name text NOT NULL DEFAULT 'Error',
  status_code int,
  message text NOT NULL DEFAULT '',
  stack_trace text,
  page_url text,
  endpoint text,
  user_email text,
  user_id uuid,
  status text NOT NULL DEFAULT 'open',
  occurrence_count int NOT NULL DEFAULT 1,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  last_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT error_log_entries_source_check CHECK (source IN ('client', 'server')),
  CONSTRAINT error_log_entries_status_check CHECK (status IN ('open', 'investigating', 'resolved'))
);

CREATE INDEX IF NOT EXISTS idx_error_log_entries_last_seen ON public.error_log_entries (last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_log_entries_status ON public.error_log_entries (status);
CREATE INDEX IF NOT EXISTS idx_error_log_entries_user_email ON public.error_log_entries (user_email);
CREATE INDEX IF NOT EXISTS idx_error_log_entries_error_name ON public.error_log_entries (error_name);
CREATE INDEX IF NOT EXISTS idx_error_log_entries_source ON public.error_log_entries (source);

ALTER TABLE public.error_log_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "no_anon_authed_access" ON public.error_log_entries
  FOR ALL
  USING (false)
  WITH CHECK (false);
