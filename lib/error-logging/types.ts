export type ErrorLogSource = "client" | "server";

export type ErrorLogStatus = "open" | "investigating" | "resolved";

export type RecordErrorInput = {
  source: ErrorLogSource;
  errorName: string;
  message: string;
  stackTrace?: string | null;
  pageUrl?: string | null;
  endpoint?: string | null;
  statusCode?: number | null;
  userEmail?: string | null;
  userId?: string | null;
  metadata?: Record<string, unknown>;
};

export type ErrorLogEntry = {
  id: string;
  fingerprint: string;
  source: ErrorLogSource;
  error_name: string;
  status_code: number | null;
  message: string;
  stack_trace: string | null;
  page_url: string | null;
  endpoint: string | null;
  user_email: string | null;
  user_id: string | null;
  status: ErrorLogStatus;
  occurrence_count: number;
  first_seen_at: string;
  last_seen_at: string;
  last_metadata: Record<string, unknown>;
};
