// =============================================================================
// POST /api/jobs/update-past-trips
// =============================================================================
//
// Triggers the updatePastTrips background job.
//
// SECURITY
// --------
// Protected by a secret header:
//   X-Job-Secret: <value of env var JOB_SECRET>
//
// The JOB_SECRET environment variable must be set in production.
// Requests without a matching secret are rejected with 401.
//
// USAGE
// -----
// Call this endpoint from:
//   • a cron job (Vercel Cron, GitHub Actions schedule, etc.)
//   • the mark-past-trips CLI script (prisma/scripts/)
//   • any internal orchestration that has the secret
//
// The endpoint is idempotent — calling it multiple times is safe.
//
// RESPONSE
// --------
// 200 OK:  { data: { markedPasado: number } }
// 401:     { error: { code: "UNAUTHORIZED", message: "..." } }
// 500:     { error: { code: "INTERNAL_ERROR", message: "..." } }
//
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { updatePastTrips } from "@/lib/jobs/update-past-trips";

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── Auth: require matching secret header ──────────────────────────────────
  const jobSecret = process.env["JOB_SECRET"];

  if (!jobSecret) {
    // Fail closed: if the secret is not configured, deny all requests.
    console.error("[/api/jobs/update-past-trips] JOB_SECRET is not set.");
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
    const result = await updatePastTrips();
    console.log("[/api/jobs/update-past-trips] completed:", result);
    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("[/api/jobs/update-past-trips] unexpected error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Error interno del servidor." } },
      { status: 500 },
    );
  }
}
