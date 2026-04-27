import { randomUUID } from "crypto";
import { logger } from "./logger";

export interface MainAppUploadOptions {
  buffer: Buffer;
  filename: string;
  subject: string;
  questionCount: number;
  hasVisuals: boolean;
  aiProvider?: "gemini" | "claude";
  requestId?: string;
}

export interface MainAppUploadResult {
  ok: boolean;
  status: number;
  examId?: string;
  error?: string;
  requestId: string;
}

/**
 * Ana sitenin /api/upload/analyze endpoint'ine multipart POST atar.
 * Idempotency key gönderir; ana sitede destek yoksa zararsız bir header olarak iletilir.
 */
export async function uploadToMainApp(opts: MainAppUploadOptions): Promise<MainAppUploadResult> {
  const baseUrl = process.env.MAIN_APP_URL?.trim().replace(/\/$/, "");
  const userEmail = process.env.MAIN_APP_BOT_EMAIL?.trim();
  if (!baseUrl) {
    return { ok: false, status: 0, error: "MAIN_APP_URL not set", requestId: opts.requestId ?? "" };
  }
  if (!userEmail) {
    return { ok: false, status: 0, error: "MAIN_APP_BOT_EMAIL not set", requestId: opts.requestId ?? "" };
  }

  const requestId = opts.requestId ?? randomUUID();

  const fd = new FormData();
  const blob = new Blob([new Uint8Array(opts.buffer)], { type: "application/pdf" });
  fd.append("file", blob, opts.filename);
  fd.append("subject", opts.subject);
  fd.append("questionCount", String(opts.questionCount));
  fd.append("hasVisuals", String(opts.hasVisuals));
  fd.append("aiProvider", opts.aiProvider ?? "gemini");
  fd.append("userEmail", userEmail);

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/upload/analyze`, {
      method: "POST",
      body: fd,
      headers: { "x-idempotency-key": requestId },
      signal: AbortSignal.timeout(120_000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn("uploadToMainApp network error", { requestId, msg });
    return { ok: false, status: 0, error: msg, requestId };
  }

  let parsed: unknown = null;
  try {
    parsed = await res.json();
  } catch {
    parsed = null;
  }
  const body = (parsed ?? {}) as { examId?: string; error?: string };

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: body.error ?? `HTTP ${res.status}`,
      requestId,
    };
  }
  return {
    ok: true,
    status: res.status,
    examId: body.examId,
    requestId,
  };
}
