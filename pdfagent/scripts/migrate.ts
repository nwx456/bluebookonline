import { Pool } from "pg";

const SCHEMA = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  seed_urls TEXT[] NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  default_subject TEXT,
  last_crawled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES sources(id) ON DELETE SET NULL,
  source_url TEXT NOT NULL,
  sha256 TEXT,
  size_bytes BIGINT,
  mime TEXT,
  status TEXT NOT NULL DEFAULT 'discovered',
  reject_reason TEXT,
  subject TEXT,
  question_count INT NOT NULL DEFAULT 20,
  has_visuals BOOLEAN NOT NULL DEFAULT FALSE,
  ai_provider TEXT NOT NULL DEFAULT 'gemini',
  pdf_path TEXT,
  exam_id TEXT,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  downloaded_at TIMESTAMPTZ,
  uploaded_at TIMESTAMPTZ,
  CONSTRAINT documents_status_check CHECK (status IN (
    'discovered','downloading','downloaded','validating','validated',
    'pending_review','queued_upload','uploading','uploaded','rejected','failed'
  ))
);
CREATE UNIQUE INDEX IF NOT EXISTS documents_source_url_uidx ON documents(source_url);
CREATE UNIQUE INDEX IF NOT EXISTS documents_sha256_uidx ON documents(sha256) WHERE sha256 IS NOT NULL;
CREATE INDEX IF NOT EXISTS documents_status_idx ON documents(status);

CREATE TABLE IF NOT EXISTS upload_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL,
  http_status INT,
  exam_id TEXT,
  error TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS upload_attempts_doc_idx ON upload_attempts(document_id);

CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_email TEXT,
  action TEXT NOT NULL,
  target_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audit_log_created_idx ON audit_log(created_at DESC);
`;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }
  const pool = new Pool({ connectionString: url });
  try {
    await pool.query(SCHEMA);
    console.log("[migrate] schema applied");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[migrate] failed:", err);
  process.exit(1);
});
