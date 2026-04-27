import { Queue, QueueEvents } from "bullmq";
import IORedis, { type Redis } from "ioredis";

declare global {
  var __pdfagentRedis: Redis | undefined;
  var __pdfagentQueues: { discover?: Queue; fetch?: Queue; upload?: Queue } | undefined;
}

function getRedis(): Redis {
  if (!global.__pdfagentRedis) {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error("REDIS_URL is not set");
    global.__pdfagentRedis = new IORedis(url, { maxRetriesPerRequest: null });
  }
  return global.__pdfagentRedis;
}

export const QUEUE_NAMES = {
  discover: "pdfagent.discover",
  fetch: "pdfagent.fetch",
  upload: "pdfagent.upload",
} as const;

function ensureQueues() {
  if (!global.__pdfagentQueues) {
    global.__pdfagentQueues = {};
  }
  return global.__pdfagentQueues;
}

export function discoverQueue(): Queue<DiscoverJob> {
  const q = ensureQueues();
  if (!q.discover) {
    q.discover = new Queue<DiscoverJob>(QUEUE_NAMES.discover, {
      connection: getRedis(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    });
  }
  return q.discover as Queue<DiscoverJob>;
}

export function fetchQueue(): Queue<FetchJob> {
  const q = ensureQueues();
  if (!q.fetch) {
    q.fetch = new Queue<FetchJob>(QUEUE_NAMES.fetch, {
      connection: getRedis(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 10_000 },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 1000 },
      },
    });
  }
  return q.fetch as Queue<FetchJob>;
}

export function uploadQueue(): Queue<UploadJob> {
  const q = ensureQueues();
  if (!q.upload) {
    q.upload = new Queue<UploadJob>(QUEUE_NAMES.upload, {
      connection: getRedis(),
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 15_000 },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 1000 },
      },
    });
  }
  return q.upload as Queue<UploadJob>;
}

export function redisConnection(): Redis {
  return getRedis();
}

export function makeQueueEvents(name: string): QueueEvents {
  return new QueueEvents(name, { connection: getRedis() });
}

export interface DiscoverJob {
  sourceId: string;
}

export interface FetchJob {
  documentId: string;
}

export interface UploadJob {
  documentId: string;
}
