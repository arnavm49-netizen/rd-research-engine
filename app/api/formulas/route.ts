import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

/**
 * POST /api/formulas
 * Body: { query: string, domain?: string }
 *
 * Returns both formulas and test methods in one round trip so the UI
 * doesn't have to fire two requests.
 */
export const POST = auth(async function POST(req) {
  if (!req.auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { query?: string; domain?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.query?.trim()) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  try {
    const [formulasResp, testsResp] = await Promise.all([
      fetch(`${ML_SERVICE_URL}/formulas/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      fetch(`${ML_SERVICE_URL}/formulas/tests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    ]);

    const formulasData = formulasResp.ok ? await formulasResp.json() : { formulas: [] };
    const testsData = testsResp.ok ? await testsResp.json() : { tests: [] };

    return NextResponse.json({
      formulas: formulasData.formulas ?? [],
      tests: testsData.tests ?? [],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed to reach ML service: ${msg}` }, { status: 502 });
  }
});
