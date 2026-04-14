// =============================================================================
// POST /api/jobs/snapshot-mensual
// =============================================================================
//
// Generates SnapshotMensual records for all active companies.
//
// SECURITY
// --------
// Protected by X-Job-Secret header matching the JOB_SECRET env var.
// No session required — designed to be called by cron jobs.
//
// BODY (optional JSON)
// --------------------
//   { mes?: number, anio?: number }
//   Defaults to the previous calendar month (Argentina UTC-3).
//
// RESPONSE
// --------
//   200 { data: { mes, anio, snapshots: [{ companyId, companyName, ok, error? }] } }
//   401 { error: { code: "UNAUTHORIZED" } }
//   500 { error: { code: "INTERNAL_ERROR" } }
//
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma }                    from "@/lib/prisma";
import { generarSnapshotMensual }    from "@/services/snapshot.service";

function argPrevMonth(): { mes: number; anio: number } {
  const now  = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const month = now.getUTCMonth(); // 0-indexed
  return month === 0
    ? { mes: 12, anio: now.getUTCFullYear() - 1 }
    : { mes: month, anio: now.getUTCFullYear() };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const jobSecret = process.env["JOB_SECRET"];
  if (!jobSecret) {
    console.error("[/api/jobs/snapshot-mensual] JOB_SECRET is not set.");
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

  // ── Parse body (optional) ─────────────────────────────────────────────────
  const defaults = argPrevMonth();
  let mes  = defaults.mes;
  let anio = defaults.anio;

  try {
    const body = await req.json().catch(() => ({})) as { mes?: unknown; anio?: unknown };
    if (typeof body.mes  === "number" && body.mes  >= 1 && body.mes  <= 12) mes  = body.mes;
    if (typeof body.anio === "number" && body.anio >= 2020)                  anio = body.anio;
  } catch {
    // malformed body — use defaults
  }

  // ── Run per-company ──────────────────────────────────────────────────────
  const companies = await prisma.company.findMany({
    where:  { isActive: true },
    select: { id: true, name: true },
  });

  type SnapshotResult = { companyId: string; companyName: string; ok: true }
                      | { companyId: string; companyName: string; ok: false; error: string };

  const snapshots: SnapshotResult[] = await Promise.all(
    companies.map(async (company) => {
      try {
        await generarSnapshotMensual(company.id, mes, anio);
        return { companyId: company.id, companyName: company.name, ok: true as const };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[snapshot-mensual] ERROR ${company.name}:`, err);
        return { companyId: company.id, companyName: company.name, ok: false as const, error: message };
      }
    }),
  );

  const succeeded = snapshots.filter((s) => s.ok).length;
  const failed    = snapshots.length - succeeded;
  console.log(`[snapshot-mensual] ${anio}-${mes}: ${succeeded} ok, ${failed} failed`);

  return NextResponse.json({ data: { mes, anio, snapshots } });
}
