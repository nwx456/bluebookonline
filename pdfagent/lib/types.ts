export type DocumentStatus =
  | "discovered"
  | "downloading"
  | "downloaded"
  | "validating"
  | "validated"
  | "pending_review"
  | "queued_upload"
  | "uploading"
  | "uploaded"
  | "rejected"
  | "failed";

export interface SourceRow {
  id: string;
  domain: string;
  name: string;
  seed_urls: string[];
  enabled: boolean;
  default_subject: string | null;
  last_crawled_at: string | null;
  created_at: string;
}

export interface DocumentRow {
  id: string;
  source_id: string | null;
  source_url: string;
  sha256: string | null;
  size_bytes: string | null;
  mime: string | null;
  status: DocumentStatus;
  reject_reason: string | null;
  subject: string | null;
  question_count: number;
  has_visuals: boolean;
  ai_provider: string;
  pdf_path: string | null;
  exam_id: string | null;
  discovered_at: string;
  downloaded_at: string | null;
  uploaded_at: string | null;
}

export interface AdminUserRow {
  id: string;
  email: string;
  password_hash: string;
  role: string;
  created_at: string;
}
