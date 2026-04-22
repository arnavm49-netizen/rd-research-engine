import { createIngestionWorker, type IngestionJobData } from "@/lib/queue";
import { db } from "@/lib/db";
import { getPresignedUrl } from "@/lib/storage/s3";
import { ingestDocument } from "@/lib/ml-client";
import { logAudit } from "@/lib/audit";
import type { Job } from "bullmq";

console.log("Starting ingestion worker...");

const worker = createIngestionWorker(async (job: Job<IngestionJobData>) => {
  const { documentId, fileKey, mimeType, classification } = job.data;
  console.log(`Processing document: ${documentId}`);

  try {
    // Update status to PROCESSING
    await db.document.update({
      where: { id: documentId },
      data: { status: "PROCESSING" },
    });

    // Get a presigned URL for the ML service to download
    const fileUrl = await getPresignedUrl(fileKey, 3600);

    // Get document metadata
    const doc = await db.document.findUnique({ where: { id: documentId } });

    // Call ML service for ingestion
    const result = await ingestDocument({
      document_id: documentId,
      file_url: fileUrl,
      mime_type: mimeType,
      classification,
      metadata: {
        title: doc?.title || "Untitled",
        research_areas: [],
      },
    });

    // Update document with results
    await db.document.update({
      where: { id: documentId },
      data: {
        status: "INGESTED",
        language: result.language_detected,
      },
    });

    // Create chunk records in PostgreSQL (for search/reference)
    // The actual vectors are in Qdrant, but we keep metadata in PG

    await logAudit({
      action: "DOCUMENT_INGESTED",
      entity: "Document",
      entityId: documentId,
      metadata: {
        chunks: result.chunks_created,
        vectors: result.vectors_stored,
        language: result.language_detected,
      },
    });

    console.log(
      `Document ${documentId} ingested: ${result.chunks_created} chunks, ${result.vectors_stored} vectors`
    );
  } catch (error: any) {
    console.error(`Failed to ingest document ${documentId}:`, error);

    await db.document.update({
      where: { id: documentId },
      data: {
        status: "FAILED",
        errorMessage: error.message,
      },
    });

    await logAudit({
      action: "DOCUMENT_INGESTION_FAILED",
      entity: "Document",
      entityId: documentId,
      metadata: { error: error.message },
    });

    throw error;
  }
});

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);
});

process.on("SIGTERM", async () => {
  console.log("Shutting down worker...");
  await worker.close();
  process.exit(0);
});
