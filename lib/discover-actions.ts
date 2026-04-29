/**
 * Helpers for the discover workflow:
 *   - upsert a search result into DiscoveredPaper
 *   - approve a discovered arXiv paper into the ingestion pipeline
 */

import { db } from "./db";
import { uploadFile } from "./storage/s3";
import { ingestionQueue } from "./queue";
import { logAudit } from "./audit";

export interface RawDiscoverResult {
  title: string;
  authors: string[];
  abstract: string | null;
  doi: string | null;
  url: string | null;
  source: string;
  publication_year: number | null;
  relevance_score?: number;
}

/**
 * Upsert a discovery search result into the database. Returns the persisted
 * row with its id so the UI can act on it later.
 *
 * Dedupe order: DOI first, then exact URL, then normalized title.
 */
export async function persistDiscovered(result: RawDiscoverResult) {
  const titleKey = (result.title || "").trim();

  // Try to find an existing row to update rather than create duplicates.
  let existing = null;
  if (result.doi) {
    existing = await db.discoveredPaper.findUnique({ where: { doi: result.doi } });
  }
  if (!existing && result.url) {
    existing = await db.discoveredPaper.findFirst({ where: { url: result.url } });
  }
  if (!existing && titleKey) {
    existing = await db.discoveredPaper.findFirst({
      where: { title: { equals: titleKey, mode: "insensitive" } },
    });
  }

  if (existing) {
    return db.discoveredPaper.update({
      where: { id: existing.id },
      data: {
        relevanceScore: result.relevance_score ?? existing.relevanceScore,
        // Don't overwrite a user's curation status if they've already triaged this paper
      },
    });
  }

  return db.discoveredPaper.create({
    data: {
      title: result.title,
      authors: result.authors ?? [],
      abstract: result.abstract,
      doi: result.doi,
      url: result.url,
      source: result.source,
      publicationYear: result.publication_year,
      relevanceScore: result.relevance_score ?? null,
      status: "NEW",
    },
  });
}

/**
 * For arXiv URLs we can fetch the PDF directly. Returns null for sources we
 * can't auto-fetch (most journals paywall the PDF).
 */
function pdfUrlFor(paper: { source: string; url: string | null; doi: string | null }): string | null {
  const url = paper.url || "";
  if (paper.source === "arxiv" || url.includes("arxiv.org")) {
    // arxiv.org/abs/2403.01234v1 → arxiv.org/pdf/2403.01234v1.pdf
    const match = url.match(/arxiv\.org\/abs\/([\w./-]+)/);
    if (match) return `https://arxiv.org/pdf/${match[1]}.pdf`;
  }
  return null;
}

/**
 * "Approve" a discovered paper. For arXiv we auto-download the PDF and queue
 * it for ingestion. For other sources we mark APPROVED and tell the caller
 * the user needs to upload the PDF manually.
 */
export async function approveDiscovered(
  discoveredPaperId: string,
  userId: string,
): Promise<{
  status: "ingestion_queued" | "manual_upload_required";
  documentId?: string;
  message: string;
}> {
  const paper = await db.discoveredPaper.findUnique({ where: { id: discoveredPaperId } });
  if (!paper) throw new Error("Discovered paper not found");

  const pdfUrl = pdfUrlFor(paper);

  if (!pdfUrl) {
    // Can't fetch PDF — just mark approved
    await db.discoveredPaper.update({
      where: { id: discoveredPaperId },
      data: { status: "APPROVED" },
    });
    await logAudit({
      actorId: userId,
      action: "DISCOVERED_PAPER_APPROVED",
      entity: "DiscoveredPaper",
      entityId: discoveredPaperId,
      metadata: { source: paper.source, requiresManualUpload: true },
    });
    return {
      status: "manual_upload_required",
      message: `Approved. ${paper.source} doesn't allow direct PDF fetch — please open the source URL and upload the PDF manually via the Library.`,
    };
  }

  // Fetch the PDF
  const pdfResponse = await fetch(pdfUrl, {
    headers: { "User-Agent": "RDResearchEngine/1.0 (+https://github.com/arnavm49-netizen/rd-research-engine)" },
  });
  if (!pdfResponse.ok) {
    throw new Error(`Failed to fetch PDF (${pdfResponse.status}): ${pdfUrl}`);
  }
  const buffer = Buffer.from(await pdfResponse.arrayBuffer());

  // Upload to R2
  const safeTitle = paper.title.replace(/[^a-z0-9]+/gi, "_").slice(0, 80);
  const fileKey = `documents/discover/${Date.now()}-${safeTitle}.pdf`;
  await uploadFile(fileKey, buffer, "application/pdf");

  // Create Document row
  const document = await db.document.create({
    data: {
      title: paper.title,
      authors: paper.authors,
      abstract: paper.abstract,
      type: "PAPER",
      classification: "PUBLIC",
      status: "PENDING_INGESTION",
      fileKey,
      fileName: `${safeTitle}.pdf`,
      fileSize: buffer.length,
      mimeType: "application/pdf",
      doi: paper.doi,
      publicationYear: paper.publicationYear,
      source: paper.source,
      uploadedById: userId,
    },
  });

  // Mark discovered paper as ingested
  await db.discoveredPaper.update({
    where: { id: discoveredPaperId },
    data: { status: "INGESTED" },
  });

  // Queue background ingestion
  await ingestionQueue.add("ingest", {
    documentId: document.id,
    fileKey,
    mimeType: "application/pdf",
    classification: "PUBLIC",
  });

  await logAudit({
    actorId: userId,
    action: "DISCOVERED_PAPER_INGESTED",
    entity: "Document",
    entityId: document.id,
    metadata: { source: paper.source, discoveredPaperId },
  });

  return {
    status: "ingestion_queued",
    documentId: document.id,
    message: `PDF fetched (${(buffer.length / 1024).toFixed(0)} KB). Ingestion queued.`,
  };
}
