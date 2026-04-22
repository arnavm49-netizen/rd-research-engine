import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { queryDocuments } from "@/lib/ml-client";
import { logAudit } from "@/lib/audit";

export const POST = auth(async function POST(req) {
  if (!req.auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { query?: string; researchAreas?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { query, researchAreas } = body;
  if (!query?.trim()) {
    return NextResponse.json({ error: "Query is required" }, { status: 400 });
  }

  const userId = (req.auth.user as { id?: string })?.id ?? "";
  const classificationAccess =
    (req.auth.user as { classificationAccess?: string })?.classificationAccess || "PUBLIC";

  const startTime = Date.now();

  try {
    const result = await queryDocuments({
      query,
      classification_access: classificationAccess,
      top_k: 20,
      research_areas: researchAreas,
    });

    const latencyMs = Date.now() - startTime;

    if (userId) {
      const queryLog = await db.queryLog.create({
        data: {
          userId,
          query,
          response: result.answer,
          mode: result.mode === "ai_synthesis" ? "AI_SYNTHESIS" : "RETRIEVAL_ONLY",
          classification: classificationAccess as "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED",
          latencyMs,
        },
      });

      await logAudit({
        actorId: userId,
        action: "QUERY_EXECUTED",
        entity: "QueryLog",
        entityId: queryLog.id,
        metadata: { mode: result.mode, resultCount: result.total_results, latencyMs },
      });
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Query failed: ${msg}` },
      { status: 502 }
    );
  }
});
