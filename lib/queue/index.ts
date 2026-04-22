import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

// ─── Ingestion Queue ───

export const ingestionQueue = new Queue("ingestion", { connection });

export interface IngestionJobData {
  documentId: string;
  fileKey: string;
  mimeType: string;
  classification: string;
}

export function createIngestionWorker(
  processor: (job: Job<IngestionJobData>) => Promise<void>
) {
  return new Worker<IngestionJobData>("ingestion", processor, {
    connection,
    concurrency: 2,
  });
}

// ─── Discovery Queue ───

export const discoveryQueue = new Queue("discovery", { connection });

export interface DiscoveryJobData {
  researchAreaId?: string;
  query?: string;
  source?: string;
}

export function createDiscoveryWorker(
  processor: (job: Job<DiscoveryJobData>) => Promise<void>
) {
  return new Worker<DiscoveryJobData>("discovery", processor, {
    connection,
    concurrency: 1,
  });
}
