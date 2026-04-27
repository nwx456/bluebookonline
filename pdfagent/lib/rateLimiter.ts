import { redisConnection } from "./queue";

/**
 * Token bucket benzeri sade bir per-minute rate limiter (Redis tabanlı).
 * upload-worker'ın ana siteyi ezmemesi için kullanılır.
 */
export async function acquireUploadSlot(): Promise<void> {
  const perMin = Math.max(1, Number(process.env.UPLOAD_RATE_PER_MIN ?? 2));
  const redis = redisConnection();
  while (true) {
    const bucket = `pdfagent:rate:upload:${Math.floor(Date.now() / 60_000)}`;
    const count = await redis.incr(bucket);
    if (count === 1) {
      await redis.expire(bucket, 70);
    }
    if (count <= perMin) return;
    const waitMs = 60_000 - (Date.now() % 60_000) + 250;
    await new Promise((r) => setTimeout(r, waitMs));
  }
}
