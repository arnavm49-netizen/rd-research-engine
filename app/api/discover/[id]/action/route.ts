import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { approveDiscovered } from "@/lib/discover-actions";
import { logAudit } from "@/lib/audit";

export const POST = auth(async function POST(req, ctx) {
  if (!req.auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Next.js 15 wraps params in a Promise on dynamic routes
  const params = (ctx as { params?: Promise<{ id: string }> }).params;
  const resolved = params ? await params : null;
  const id = resolved?.id;
  if (!id) {
    return NextResponse.json({ error: "Missing paper id" }, { status: 400 });
  }

  let body: { action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = body.action;
  if (!action || !["approve", "flag", "reject"].includes(action)) {
    return NextResponse.json(
      { error: "action must be one of: approve, flag, reject" },
      { status: 400 }
    );
  }

  const userId = (req.auth.user as { id?: string })?.id ?? "";

  // Verify the paper exists
  const paper = await db.discoveredPaper.findUnique({ where: { id } });
  if (!paper) {
    return NextResponse.json({ error: "Discovered paper not found" }, { status: 404 });
  }

  try {
    if (action === "flag") {
      await db.discoveredPaper.update({
        where: { id },
        data: { status: "FLAGGED" },
      });
      await logAudit({
        actorId: userId,
        action: "DISCOVERED_PAPER_FLAGGED",
        entity: "DiscoveredPaper",
        entityId: id,
      });
      return NextResponse.json({ status: "flagged", message: "Paper flagged for review." });
    }

    if (action === "reject") {
      await db.discoveredPaper.update({
        where: { id },
        data: { status: "REJECTED" },
      });
      await logAudit({
        actorId: userId,
        action: "DISCOVERED_PAPER_REJECTED",
        entity: "DiscoveredPaper",
        entityId: id,
      });
      return NextResponse.json({ status: "rejected", message: "Paper rejected." });
    }

    // approve — may auto-fetch + queue ingestion
    const result = await approveDiscovered(id, userId);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
});
