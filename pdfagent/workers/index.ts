import { discoverQueue } from "../lib/queue";
import { logger } from "../lib/logger";
import { startDiscoverWorker } from "./discover";
import { startFetchWorker } from "./fetch";
import { startUploadWorker } from "./upload";
import { query } from "../lib/db";
import type { SourceRow } from "../lib/types";

async function scheduleCronDiscover() {
  const cron = (process.env.DISCOVER_CRON ?? "0 */6 * * *").trim();
  const { rows } = await query<SourceRow>(`SELECT id FROM sources WHERE enabled = TRUE`);
  for (const s of rows) {
    await discoverQueue().add(
      "discover",
      { sourceId: s.id },
      {
        repeat: { pattern: cron },
        jobId: `cron-discover:${s.id}`,
      }
    );
  }
  logger.info("scheduled discover cron jobs", { count: rows.length, cron });
}

async function main() {
  logger.info("pdfagent worker starting", {
    env: process.env.NODE_ENV ?? "development",
  });
  const discover = startDiscoverWorker();
  const fetcher = startFetchWorker();
  const uploader = startUploadWorker();

  for (const w of [discover, fetcher, uploader]) {
    w.on("failed", (job, err) => {
      logger.error("job failed", {
        queue: w.name,
        jobId: job?.id,
        attempts: job?.attemptsMade,
        err: err?.message,
      });
    });
    w.on("completed", (job) => {
      logger.debug("job done", { queue: w.name, jobId: job.id });
    });
  }

  await scheduleCronDiscover();

  const shutdown = async (sig: string) => {
    logger.info("shutting down", { sig });
    await Promise.all([discover.close(), fetcher.close(), uploader.close()]);
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.error("worker entry failed", { err: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
