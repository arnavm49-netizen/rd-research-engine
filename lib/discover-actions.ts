/**
 * Helpers for the discover workflow:
 *   - upsert a search result into DiscoveredPaper
 *   - approve a discovered arXiv paper into the ingestion pipeline
 */

import { db } from "./db";
import { uploadFile } from "./storage/s3";
import { ingestionQueue } from "./queue";
import { logAudit } from "./audit";
import { locatePdf } from "./pdf-locator";

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
 * "Approve" a discovered paper. Tries multiple strategies to locate a free
 * PDF (arXiv URL transform → Unpaywall → Semantic Scholar OA → arXiv title
 * search) before giving up. Most journal papers have an OA copy somewhere.
 *
 * If a PDF is found, it's downloaded, uploaded to R2, and queued for
 * ingestion. If every strategy fails, we mark APPROVED and ask the user
 * to upload manually.
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

  const located = await locatePdf({
    title: paper.title,
    doi: paper.doi,
    url: paper.url,
    source: paper.source,
  });

  if (!located) {
    // No free PDF found — mark approved and ask for manual upload
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
      message: `Approved, but no free PDF found via arXiv, Unpaywall, or Semantic Scholar. Open the source page and upload manually via Library.`,
    };
  }

  // Fetch the located PDF
  const pdfResponse = await fetch(located.url, {
    headers: {
      "User-Agent": "RDResearchEngine/1.0 (+https://github.com/arnavm49-netizen/rd-research-engine)",
      Accept: "application/pdf,*/*",
    },
    redirect: "follow",
  });
  if (!pdfResponse.ok) {
    throw new Error(`Failed to fetch PDF via ${located.strategy} (${pdfResponse.status}): ${located.url}`);
  }
  const buffer = Buffer.from(await pdfResponse.arrayBuffer());

  // Sanity check — sometimes OA links return an HTML landing page instead
  // of a real PDF. Reject anything obviously not a PDF.
  const head = buffer.slice(0, 5).toString("utf-8");
  if (!head.startsWith("%PDF-")) {
    throw new Error(
      `Located URL via ${located.strategy} returned non-PDF content (got ${head.trim()}...). Try uploading manually.`,
    );
  }

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
    metadata: { source: paper.source, discoveredPaperId, pdfStrategy: located.strategy },
  });

  return {
    status: "ingestion_queued",
    documentId: document.id,
    message: `PDF fetched via ${located.strategy} (${(buffer.length / 1024).toFixed(0)} KB). Ingestion queued.`,
  };
}
