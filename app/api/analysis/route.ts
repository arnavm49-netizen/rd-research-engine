import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

/**
 * GET /api/analysis
 *
 * Returns research coverage analysis built from real DB data:
 *   - all configured ResearchAreas
 *   - actual document count per area
 *   - calls ML service /gaps/coverage to apply the analysis rules
 */
export const GET = auth(async function GET(req) {
  if (!req.auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Pull research areas + their document counts in one go
  const researchAreas = await db.researchArea.findMany({
    where: { isActive: true },
    include: {
      _count: { select: { documents: true } },
    },
    orderBy: { name: "asc" },
  });

  const totalDocuments = await db.document.count();

  const documentCounts: Record<string, number> = {};
  const areasForMl: { name: string; keywords: string[] }[] = [];
  for (const area of researchAreas) {
    documentCounts[area.name] = area._count.documents;
    areasForMl.push({ name: area.name, keywords: area.keywords });
  }

  try {
    const response = await fetch(`${ML_SERVICE_URL}/gaps/coverage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        research_areas: areasForMl,
        document_counts: documentCounts,
        total_documents: totalDocuments,
      }),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Analysis service error (${response.status})`, coverage: [] },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      total_documents: totalDocuments,
      research_areas_count: researchAreas.length,
      coverage: data.coverage ?? [],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to reach ML service: ${msg}`, coverage: [] },
      { status: 502 }
    );
  }
});
