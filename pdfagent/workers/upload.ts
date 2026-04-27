import { randomUUID } from "crypto";
import { Worker, type Job } from "bullmq";
import { audit } from "../lib/audit";
import { query } from "../lib/db";
import { logger } from "../lib/logger";
import {
  QUEUE_NAMES,
  redisConnection,
  type UploadJob,
} from "../lib/queue";
import { acquireUploadSlot } from "../lib/rateLimiter";
import { loadPdf } from "../lib/storage";
import { isValidSubject } from "../lib/subjects";
import type { DocumentRow } from "../lib/types";
import { uploadToMainApp } from "../lib/uploadClient";

const DEFAULT_SUBJECT = "AP_PSYCHOLOGY";

export async function runUpload(documentId: string): Promise<void> {
  const { rows } = await query<DocumentRow>(
    `SELECT * FROM documents WHERE id = $1 LIMIT 1`,
    [documentId]
  );
  const doc = rows[0];
  if (!doc) {
    logger.warn("upload: document missing", { documentId });
    return;
  }
  if (doc.status !== "queued_upload" && doc.status !== "failed") {
    logger.info("upload: skipping (status not eligible)", { documentId, status: doc.status });
    return;
  }
  if (!doc.pdf_path) {
    await query(
      `UPDATE documents SET status = 'failed', reject_reason = $2 WHERE id = $1`,
      [documentId, "missing pdf_path"]
    );
    return;
  }

  await query(`UPDATE documents SET status = 'uploading' WHERE id = $1`, [documentId]);
  await acquireUploadSlot();

  let buffer: Buffer;
  try {
    buffer = await loadPdf(documentId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await query(
      `UPDATE documents SET status = 'failed', reject_reason = $2 WHERE id = $1`,
      [documentId, `load pdf: ${msg}`.slice(0, 500)]
    );
    return;
  }

  const subject = doc.subject && isValidSubject(doc.subject) ? doc.subject : DEFAULT_SUBJECT;
  const requestId = randomUUID();
  const filename = (() => {
    try {
      const u = new URL(doc.source_url);
      const last = u.pathname.split("/").filter(Boolean).pop() ?? `${documentId}.pdf`;
      return last.toLowerCase().endsWith(".pdf") ? last : `${last}.pdf`;
    } catch {
      return `${documentId}.pdf`;
    }
  })();

  const result = await uploadToMainApp({
    buffer,
    filename,
    subject,
    questionCount: doc.question_count,
    hasVisuals: doc.has_visuals,
    aiProvider: (doc.ai_provider as "gemini" | "claude") ?? "gemini",
    requestId,
  });

  await query(
    `INSERT INTO upload_attempts (document_id, request_id, http_status, exam_id, error)
     VALUES ($1, $2, $3, $4, $5)`,
    [documentId, requestId, result.status, result.examId ?? null, result.ok ? null : (result.error ?? null)]
  );

  if (!result.ok) {
    await query(
      `UPDATE documents SET status = 'failed', reject_reason = $2 WHERE id = $1`,
      [documentId, (result.error ?? `HTTP ${result.status}`).slice(0, 500)]
    );
    await audit("upload.fail", {
      targetId: documentId,
      details: { status: result.status, error: result.error, requestId },
    });
    throw new Error(`upload failed: ${result.error ?? result.status}`);
  }

  await query(
    `UPDATE documents SET status = 'uploaded', exam_id = $2, uploaded_at = NOW() WHERE id = $1`,
    [documentId, result.examId ?? null]
  );
  await audit("upload.ok", {
    targetId: documentId,
    details: { examId: result.examId, requestId },
  });
  logger.info("upload ok", { documentId, examId: result.examId });
}

export function startUploadWorker(): Worker<UploadJob> {
  return new Worker<UploadJob>(
    QUEUE_NAMES.upload,
    async (job: Job<UploadJob>) => {
      await runUpload(job.data.documentId);
    },
    {
      connection: redisConnection(),
      concurrency: 1,
    }
  );
}
