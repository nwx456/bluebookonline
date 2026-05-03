-- Admin mail audit log + async broadcast jobs (run in Supabase SQL editor).
-- Service role API routes insert/update these tables.

CREATE TABLE IF NOT EXISTS outbound_email_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  admin_email text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  subject text NOT NULL,
  body text NOT NULL,
  recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
  cursor_index int NOT NULL DEFAULT 0,
  sent int NOT NULL DEFAULT 0,
  failed int NOT NULL DEFAULT 0,
  skipped int NOT NULL DEFAULT 0,
  first_error text,
  total_recipients int NOT NULL DEFAULT 0,
  processed_at timestamptz,
  CONSTRAINT outbound_email_jobs_status_check CHECK (
    status IN ('pending', 'processing', 'done', 'failed')
  )
);

CREATE INDEX IF NOT EXISTS idx_outbound_jobs_status_created ON outbound_email_jobs (status, created_at);

CREATE TABLE IF NOT EXISTS admin_mail_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  admin_email text NOT NULL,
  subject text NOT NULL DEFAULT '',
  body_preview text,
  recipient_count int NOT NULL DEFAULT 0,
  sent int NOT NULL DEFAULT 0,
  failed int NOT NULL DEFAULT 0,
  skipped int NOT NULL DEFAULT 0,
  first_error text,
  is_test boolean NOT NULL DEFAULT false,
  job_id uuid REFERENCES outbound_email_jobs (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_mail_log_created ON admin_mail_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_mail_log_job ON admin_mail_log (job_id);
