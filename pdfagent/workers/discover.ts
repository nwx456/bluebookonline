import { Worker, type Job } from "bullmq";
import { getHostname, isRobotsAllowed, matchesStaticAllowlist } from "../lib/allowlist";
import { audit } from "../lib/audit";
import { query } from "../lib/db";
import { logger } from "../lib/logger";
import {
  QUEUE_NAMES,
  fetchQueue,
  redisConnection,
  type DiscoverJob,
} from "../lib/queue";
import type { SourceRow, DocumentRow } from "../lib/types";

const HREF_RE = /href\s*=\s*"([^"]+\.pdf(?:\?[^"]*)?)"/gi;

async function listSeedUrls(sourceId: string): Promise<{ source: SourceRow; seedUrls: string[] } | null> {
  const { rows } = await query<SourceRow>(
    `SELECT * FROM sources WHERE id = $1 AND enabled = TRUE LIMIT 1`,
    [sourceId]
  );
  const source = rows[0];
  if (!source) return null;
  return { source, seedUrls: source.seed_urls ?? [] };
}

async function expandSeedUrlToPdfs(seedUrl: string, allowedHost: string): Promise<string[]> {
  const lower = seedUrl.toLowerCase();
  if (lower.endsWith(".pdf")) return [seedUrl];

  try {
    const res = await fetch(seedUrl, {
      method: "GET",
      headers: { "user-agent": "pdfagent-bot/0.1" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const ct = (res.headers.get("content-type") ?? "").toLowerCase();
    if (!ct.includes("text/html")) return [];
    const html = await res.text();
    const found = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = HREF_RE.exec(html)) !== null) {
      const raw = m[1];
      let abs: string;
      try {
        abs = new URL(raw, seedUrl).toString();
      } catch {
        continue;
      }
      const host = getHostname(abs);
      if (!host) continue;
      if (host !== allowedHost && !host.endsWith(`.${allowedHost}`)) continue;
      if (!matchesStaticAllowlist(host)) continue;
      found.add(abs);
    }
    return Array.from(found);
  } catch (err) {
    logger.warn("discover seed expand failed", {
      seedUrl,
      err: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

export async function runDiscover(sourceId: string): Promise<{ added: number; skipped: number }> {
  const ctx = await listSeedUrls(sourceId);
  if (!ctx) {
    logger.warn("discover: source not found or disabled", { sourceId });
    return { added: 0, skipped: 0 };
  }
  const { source, seedUrls } = ctx;
  let added = 0;
  let skipped = 0;

  for (const seed of seedUrls) {
    const host = getHostname(seed);
    if (!host || !matchesStaticAllowlist(host) || (host !== source.domain && !host.endsWith(`.${source.domain}`))) {
      skipped++;
      continue;
    }
    const robotsOk = await isRobotsAllowed(seed);
    if (!robotsOk) {
      skipped++;
      continue;
    }
    const pdfUrls = await expandSeedUrlToPdfs(seed, source.domain);
    for (const pdfUrl of pdfUrls) {
      const robotsOkPdf = await isRobotsAllowed(pdfUrl);
      if (!robotsOkPdf) {
        skipped++;
        continue;
      }
      const insert = await query<DocumentRow>(
        `INSERT INTO documents (source_id, source_url, status, subject, has_visuals)
         VALUES ($1, $2, 'discovered', $3, FALSE)
         ON CONFLICT (source_url) DO NOTHING
         RETURNING id`,
        [source.id, pdfUrl, source.default_subject]
      );
      if (insert.rowCount && insert.rows[0]) {
        await fetchQueue().add(
          "fetch",
          { documentId: insert.rows[0].id },
          { jobId: `fetch:${insert.rows[0].id}` }
        );
        added++;
      } else {
        skipped++;
      }
    }
  }

  await query(`UPDATE sources SET last_crawled_at = NOW() WHERE id = $1`, [source.id]);
  await audit("discover.run", {
    targetId: source.id,
    details: { added, skipped, domain: source.domain },
  });
  logger.info("discover done", { sourceId: source.id, domain: source.domain, added, skipped });
  return { added, skipped };
}

export function startDiscoverWorker(): Worker<DiscoverJob> {
  return new Worker<DiscoverJob>(
    QUEUE_NAMES.discover,
    async (job: Job<DiscoverJob>) => {
      return runDiscover(job.data.sourceId);
    },
    {
      connection: redisConnection(),
      concurrency: 1,
    }
  );
}
