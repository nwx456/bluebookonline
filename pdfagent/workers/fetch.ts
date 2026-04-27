import { Worker, type Job } from "bullmq";
import { isRobotsAllowed, isUrlAllowed } from "../lib/allowlist";
import { audit } from "../lib/audit";
import { query } from "../lib/db";
import { logger } from "../lib/logger";
import {
  QUEUE_NAMES,
  redisConnection,
  type FetchJob,
} from "../lib/queue";
import { savePdf } from "../lib/storage";
import type { DocumentRow } from "../lib/types";
import { getMaxBytes, validatePdfBuffer } from "../lib/validator";

const REDIRECT_LIMIT = 3;

async function fetchPdf(url: string): Promise<{
  ok: true;
  buffer: Buffer;
  mime: string | null;
} | { ok: false; reason: string }> {
  let current = url;
  for (let i = 0; i <= REDIRECT_LIMIT; i++) {
    let res: Response;
    try {
      res = await fetch(current, {
        method: "GET",
        redirect: "manual",
        headers: { "user-agent": "pdfagent-bot/0.1", accept: "application/pdf" },
        signal: AbortSignal.timeout(60_000),
      });
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : String(err) };
    }

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return { ok: false, reason: `redirect ${res.status} without location` };
      const next = (() => {
        try {
          return new URL(loc, current).toString();
        } catch {
          return null;
        }
      })();
      if (!next) return { ok: false, reason: "invalid redirect location" };
      const allowed = await isUrlAllowed(next);
      if (!allowed.ok) return { ok: false, reason: `redirect blocked: ${allowed.reason}` };
      current = next;
      continue;
    }

    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };

    const max = getMaxBytes();
    const cl = Number(res.headers.get("content-length"));
    if (Number.isFinite(cl) && cl > max) {
      return { ok: false, reason: `content-length ${cl} exceeds max ${max}` };
    }
    const ct = res.headers.get("content-type");
    const ab = await res.arrayBuffer();
    if (ab.byteLength > max) {
      return { ok: false, reason: `body ${ab.byteLength} exceeds max ${max}` };
    }
    return { ok: true, buffer: Buffer.from(ab), mime: ct };
  }
  return { ok: false, reason: "too many redirects" };
}

export async function runFetch(documentId: string): Promise<void> {
  const { rows } = await query<DocumentRow>(
    `SELECT * FROM documents WHERE id = $1 LIMIT 1`,
    [documentId]
  );
  const doc = rows[0];
  if (!doc) {
    logger.warn("fetch: document missing", { documentId });
    return;
  }
  if (doc.status !== "discovered" && doc.status !== "failed") {
    logger.info("fetch: skipping (status not eligible)", { documentId, status: doc.status });
    return;
  }

  await query(`UPDATE documents SET status = 'downloading' WHERE id = $1`, [documentId]);

  const allow = await isUrlAllowed(doc.source_url);
  if (!allow.ok) {
    await query(
      `UPDATE documents SET status = 'rejected', reject_reason = $2 WHERE id = $1`,
      [documentId, `allowlist: ${allow.reason}`]
    );
    await audit("fetch.rejected", { targetId: documentId, details: { reason: allow.reason } });
    return;
  }
  if (!(await isRobotsAllowed(doc.source_url))) {
    await query(
      `UPDATE documents SET status = 'rejected', reject_reason = $2 WHERE id = $1`,
      [documentId, "robots.txt disallow"]
    );
    return;
  }

  const result = await fetchPdf(doc.source_url);
  if (!result.ok) {
    await query(
      `UPDATE documents SET status = 'failed', reject_reason = $2 WHERE id = $1`,
      [documentId, result.reason.slice(0, 500)]
    );
    logger.warn("fetch failed", { documentId, reason: result.reason });
    return;
  }

  const validation = validatePdfBuffer(result.buffer, result.mime);
  if (!validation.ok) {
    await query(
      `UPDATE documents SET status = 'rejected', reject_reason = $2 WHERE id = $1`,
      [documentId, `validation: ${validation.reason}`]
    );
    await audit("fetch.invalid", { targetId: documentId, details: { reason: validation.reason } });
    return;
  }

  // SHA dedup: aynı sha256 başka bir dokümanda varsa rejected
  if (validation.sha256) {
    const dup = await query<DocumentRow>(
      `SELECT id FROM documents WHERE sha256 = $1 AND id <> $2 AND status IN ('uploaded','queued_upload','uploading','validated','pending_review') LIMIT 1`,
      [validation.sha256, documentId]
    );
    if (dup.rowCount && dup.rows.length > 0) {
      await query(
        `UPDATE documents SET status = 'rejected', reject_reason = 'duplicate sha256', sha256 = $2, size_bytes = $3, mime = $4 WHERE id = $1`,
        [documentId, validation.sha256, validation.size ?? null, validation.mime ?? null]
      );
      return;
    }
  }

  const path = await savePdf(documentId, result.buffer);
  const autoApprove = (process.env.AUTO_APPROVE ?? "false").toLowerCase() === "true";
  const nextStatus = autoApprove ? "queued_upload" : "pending_review";
  await query(
    `UPDATE documents
       SET status = $2, sha256 = $3, size_bytes = $4, mime = $5, pdf_path = $6, downloaded_at = NOW()
       WHERE id = $1`,
    [documentId, nextStatus, validation.sha256, validation.size, validation.mime, path]
  );
  await audit("fetch.ok", {
    targetId: documentId,
    details: { sha256: validation.sha256, size: validation.size, autoApprove },
  });
  logger.info("fetch ok", { documentId, sha256: validation.sha256, size: validation.size, nextStatus });

  if (autoApprove) {
    const { uploadQueue } = await import("../lib/queue");
    await uploadQueue().add("upload", { documentId }, { jobId: `upload:${documentId}` });
  }
}

export function startFetchWorker(): Worker<FetchJob> {
  return new Worker<FetchJob>(
    QUEUE_NAMES.fetch,
    async (job: Job<FetchJob>) => {
      await runFetch(job.data.documentId);
    },
    {
      connection: redisConnection(),
      concurrency: 2,
    }
  );
}
