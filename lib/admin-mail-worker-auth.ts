import type { NextRequest } from "next/server";

/** Validates cron or internal worker requests. */
export function isAuthorizedMailWorkerRequest(request: NextRequest): boolean {
  const workerSecret = (process.env.MAIL_WORKER_SECRET ?? "").trim();
  if (workerSecret) {
    const headerSecret = request.headers.get("x-mail-worker-secret");
    if (headerSecret === workerSecret) return true;
  }

  const cronSecret = (process.env.CRON_SECRET ?? "").trim();
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth === `Bearer ${cronSecret}`) return true;
    if (request.headers.get("x-cron-secret") === cronSecret) return true;
  }

  return false;
}

export function getMailWorkerBaseUrl(): string {
  return (
    (process.env.NEXT_PUBLIC_BASE_URL ?? "").replace(/\/$/, "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")
  );
}

export function isMailWorkerKickConfigured(): boolean {
  const secret = (process.env.MAIL_WORKER_SECRET ?? "").trim();
  const base = getMailWorkerBaseUrl();
  return Boolean(secret && base);
}
