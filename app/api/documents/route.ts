import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { uploadFile } from "@/lib/storage/s3";
import { logAudit } from "@/lib/audit";
import { ingestionQueue } from "@/lib/queue";
import type { DocumentType, ClassificationLevel } from "@prisma/client";

export const GET = auth(async function GET(req) {
  if (!req.auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const documents = await db.document.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      researchAreas: { include: { researchArea: true } },
      _count: { select: { chunks: true } },
    },
    take: 100,
  });

  return NextResponse.json(documents);
});

export const POST = auth(async function POST(req) {
  if (!req.auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (req.auth.user as { id?: string })?.id;
  if (!userId) {
    return NextResponse.json({ error: "User session missing id" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const title = (formData.get("title") as string) || file?.name || "Untitled";
  const classification = (formData.get("classification") as string) || "PUBLIC";
  const type = (formData.get("type") as string) || "PAPER";

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  try {
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileKey = `documents/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
    await uploadFile(fileKey, fileBuffer, file.type);

    const document = await db.document.create({
      data: {
        title,
        type: type as DocumentType,
        classification: classification as ClassificationLevel,
        status: "PENDING_INGESTION",
        fileKey,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        uploadedById: userId,
      },
    });

    await ingestionQueue.add("ingest", {
      documentId: document.id,
      fileKey,
      mimeType: file.type,
      classification,
    });

    await logAudit({
      actorId: userId,
      action: "DOCUMENT_UPLOADED",
      entity: "Document",
      entityId: document.id,
      metadata: { title, classification, type, fileSize: file.size },
    });

    return NextResponse.json(document, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Upload failed: ${msg}` }, { status: 500 });
  }
});
