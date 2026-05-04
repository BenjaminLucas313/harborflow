// =============================================================================
// POST /api/jobs/cleanup-audit-log
// =============================================================================
//
// Deletes AuditLog records older than 12 months.
//
// SECURITY
// --------
// Protected by a secret header:
//   X-Job-Secret: <value of env var JOB_SECRET>
//
// USAGE
// -----
// Intended to run monthly via cron. Safe to call manually.
// Idempotent — repeated calls only delete what remains.
//
// RESPONSE
// --------
// 200 OK:  { deleted: number }
// 401:     { error: { code: "UNAUTHORIZED", message: "..." } }
// 500:     { error: { code: "INTERNAL_ERROR", message: "..." } }
//
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── Auth: require matching secret header ──────────────────────────────────
  const jobSecret = process.env["JOB_SECRET"];

  if (!jobSecret) {
    console.error("[/api/jobs/cleanup-audit-log] JOB_SECRET is not set.");
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Job no configurado." } },
      { status: 500 },
    );
  }

  const provided = req.headers.get("x-job-secret");
  if (!provided || provided !== jobSecret) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Secret inválido o ausente." } },
      { status: 401 },
    );
  }

  // ── Run job ───────────────────────────────────────────────────────────────
  try {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 12);

    const { count } = await prisma.auditLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    console.log(`[/api/jobs/cleanup-audit-log] deleted ${count} records older than ${cutoff.toISOString()}`);
    return NextResponse.json({ deleted: count });
  } catch (err) {
    console.error("[/api/jobs/cleanup-audit-log] unexpected error:", err);
    Sentry.captureException(err, { tags: { job: "cleanup-audit-log" } });
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Error interno del servidor." } },
      { status: 500 },
    );
  }
}
