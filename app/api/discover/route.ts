import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

// Use NextAuth v5's wrapped-handler pattern so `req.auth` is populated reliably.
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

    const results = await response.json();
    return NextResponse.json(results);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to reach ML service: ${msg}` },
      { status: 502 }
    );
  }
});
