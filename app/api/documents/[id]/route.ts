import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { deleteFile } from "@/lib/storage/s3";
import { logAudit } from "@/lib/audit";

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

/**
 * DELETE /api/documents/[id]
 *
 * Removes a document end-to-end:
 *   1. Delete vectors from Qdrant (so RAG queries stop returning this doc)
 *   2. Delete the file from R2
 *   3. Delete the DB row (cascades to chunks, citations, annotations)
 *
 * Each step is best-effort. If Qdrant or R2 fail, we still delete the DB row
 * so the user gets immediate feedback. The orphaned vectors/files can be
 * cleaned up by a background reaper later.
 */
export const DELETE = auth(async function DELETE(req, ctx) {
  if (!req.auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = (ctx as { params?: Promise<{ id: string }> }).params;
  const resolved = params ? await params : null;
  const id = resolved?.id;
  if (!id) {
    return NextResponse.json({ error: "Missing document id" }, { status: 400 });
  }

  const userId = (req.auth.user as { id?: string })?.id ?? "";

  const doc = await db.document.findUnique({ where: { id } });
  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const warnings: string[] = [];

  // Step 1: Qdrant — non-blocking
  try {
    const resp = await fetch(`${ML_SERVICE_URL}/ingest/document/${id}`, {
      method: "DELETE",
    });
    if (!resp.ok && resp.status !== 404) {
      warnings.push(`Qdrant cleanup returned ${resp.status}`);
    }
  } catch (err: unknown) {
    warnings.push(`Qdrant cleanup failed: ${err instanceof Error ? err.message : "unknown"}`);
  }

  // Step 2: R2 — non-blocking
  if (doc.fileKey) {
    try {
      await deleteFile(doc.fileKey);
    } catch (err: unknown) {
      warnings.push(`R2 cleanup failed: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  // Step 3: DB — must succeed
  await db.document.delete({ where: { id } });

  await logAudit({
    actorId: userId,
    action: "DOCUMENT_DELETED",
    entity: "Document",
    entityId: id,
    metadata: {
      title: doc.title,
      classification: doc.classification,
      warnings: warnings.length ? warnings : undefined,
    },
  });

  return NextResponse.json({
    deleted: true,
    title: doc.title,
    warnings,
  });
});
