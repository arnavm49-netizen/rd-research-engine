import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { persistDiscovered, type RawDiscoverResult } from "@/lib/discover-actions";

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

export const POST = auth(async function POST(req) {
  if (!req.auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let mlResults: RawDiscoverResult[];
  try {
    const response = await fetch(`${ML_SERVICE_URL}/discover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: `Discovery service error (${response.status}): ${text.slice(0, 200)}` },
        { status: response.status }
      );
    }

    mlResults = (await response.json()) as RawDiscoverResult[];
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed to reach ML service: ${msg}` }, { status: 502 });
  }

  // Persist each result so the UI can act on it (approve/flag/reject) by id.
  // We do these sequentially to avoid hammering the DB on a 20-result page.
  const persisted = [];
  for (const r of mlResults) {
    try {
      const row = await persistDiscovered(r);
      persisted.push({
        id: row.id,
        title: row.title,
        authors: row.authors,
        abstract: row.abstract,
        doi: row.doi,
        url: row.url,
        source: row.source,
        publication_year: row.publicationYear,
        relevance_score: row.relevanceScore,
        status: row.status,
      });
    } catch (err) {
      console.error("persistDiscovered failed for one result:", err);
      // Skip the broken row but keep going so the user still gets results
    }
  }

  return NextResponse.json(persisted);
});
