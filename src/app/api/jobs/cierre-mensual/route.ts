// =============================================================================
// POST /api/jobs/cierre-mensual
// =============================================================================
//
// Monthly close agent — orchestrates the full end-of-month settlement cycle:
//
//   A. Idempotency check  — skip if all companies already have a snapshot.
//   B. Liquidaciones      — compute seat distribution for PASADO trips.
//   C. Snapshots          — generate SnapshotMensual per active company.
//   D. Informe narrativo  — AI executive brief via Claude (per company).
//   E. Emails             — send monthly department summaries (per company).
//   F. Audit log          — record CIERRE_MENSUAL_COMPLETADO.
//
// SECURITY
// --------
// Protected by X-Job-Secret header matching the JOB_SECRET env var.
// No session required — designed to be called by a VPS cron job.
//
// BODY (optional JSON)
// --------------------
//   { mes?: number, anio?: number }
//   Defaults to the current calendar month (Argentina UTC-3).
//
// RESPONSE 200
// ------------
//   {
//     data: {
//       mes, anio,
//       yaRealizado?: true,
//       viajesLiquidados: number,
//       snapshotsGenerados: number,
//       informesGenerados: number,
//       emailsEnviados: number, emailsOmitidos: number, emailsErrores: number,
//       errores: string[]   // non-fatal errors encountered during processing
//     }
//   }
//
// IDEMPOTENCY
// -----------
// Each underlying operation (calcularDistribucionViaje, generarSnapshotMensual,
// generarInformeNarrativo) is idempotent. Re-running the job for the same
// period is safe — it just returns early via the PASO A check.
//
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import * as Sentry                   from "@sentry/nextjs";
import { prisma }                    from "@/lib/prisma";
import { logAction }                 from "@/modules/audit/repository";
import { calcularDistribucionViaje } from "@/services/liquidacion.service";
import { generarSnapshotMensual }    from "@/services/snapshot.service";
import { generarInformeNarrativo }   from "@/services/informe.service";
import { enviarResumenMensualEmpresa } from "@/services/email.service";

// Argentina: UTC-3, no DST
const ARG_OFFSET_MS = 3 * 60 * 60 * 1000;

function argCurrentMonth(): { mes: number; anio: number } {
  const now = new Date(Date.now() - ARG_OFFSET_MS);
  return { mes: now.getUTCMonth() + 1, anio: now.getUTCFullYear() };
}

function periodRange(mes: number, anio: number): { from: Date; to: Date } {
  return {
    from: new Date(Date.UTC(anio, mes - 1, 1, 3, 0, 0, 0)),
    to:   new Date(Date.UTC(anio, mes,     1, 2, 59, 59, 999)),
  };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const jobSecret = process.env["JOB_SECRET"];
  if (!jobSecret) {
    console.error("[cierre-mensual] JOB_SECRET is not set.");
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
  const defaults = argCurrentMonth();
  let mes  = defaults.mes;
  let anio = defaults.anio;

  try {
    const body = await req.json().catch(() => ({})) as { mes?: unknown; anio?: unknown };
    if (typeof body.mes  === "number" && body.mes  >= 1 && body.mes  <= 12) mes  = body.mes;
    if (typeof body.anio === "number" && body.anio >= 2020)                  anio = body.anio;
  } catch {
    // malformed body — use defaults
  }

  const { from, to } = periodRange(mes, anio);
  const tag = `[cierre-mensual] ${anio}-${String(mes).padStart(2, "0")}`;
  const errores: string[] = [];

  // ── Fetch active companies once ───────────────────────────────────────────
  const companies = await prisma.company.findMany({
    where:  { isActive: true },
    select: { id: true, name: true },
  });

  if (companies.length === 0) {
    console.warn(`${tag} No active companies found.`);
    return NextResponse.json({ data: { mes, anio, viajesLiquidados: 0, snapshotsGenerados: 0, informesGenerados: 0, emailsEnviados: 0, emailsOmitidos: 0, emailsErrores: 0, errores: ["No active companies."] } });
  }

  const companyIds = companies.map((c) => c.id);

  // ─────────────────────────────────────────────────────────────────────────
  // PASO A — Idempotency check
  // ─────────────────────────────────────────────────────────────────────────
  const existingSnapshotsCount = await prisma.snapshotMensual.count({
    where: { mes, anio, companyId: { in: companyIds } },
  });

  if (existingSnapshotsCount >= companies.length) {
    console.log(`${tag} PASO A: cierre already completed for all companies. Skipping.`);
    return NextResponse.json({
      data: { mes, anio, yaRealizado: true, message: "Cierre ya realizado para este período." },
    });
  }

  console.log(`${tag} Starting — ${companies.length} companies, period ${from.toISOString()} → ${to.toISOString()}`);

  // ─────────────────────────────────────────────────────────────────────────
  // PASO B — Calcular liquidaciones pendientes
  // ─────────────────────────────────────────────────────────────────────────
  const pendingTrips = await prisma.trip.findMany({
    where: {
      viajeStatus:          "PASADO",
      liquidacionCalculada: false,
      departureTime:        { gte: from, lte: to },
    },
    select: { id: true, companyId: true },
  });

  let viajesLiquidados = 0;
  console.log(`${tag} PASO B: ${pendingTrips.length} trips to liquidate.`);

  for (const trip of pendingTrips) {
    try {
      await calcularDistribucionViaje(trip.id);
      viajesLiquidados++;
    } catch (err) {
      const msg = `Liquidación trip ${trip.id}: ${err instanceof Error ? err.message : String(err)}`;
      errores.push(msg);
      console.error(`${tag} ${msg}`);
      Sentry.captureException(err, { tags: { job: "cierre-mensual", step: "liquidacion" }, extra: { tripId: trip.id } });
    }
  }

  console.log(`${tag} PASO B: ${viajesLiquidados}/${pendingTrips.length} liquidated.`);

  // ─────────────────────────────────────────────────────────────────────────
  // PASO C — Generar snapshots
  // ─────────────────────────────────────────────────────────────────────────
  let snapshotsGenerados = 0;
  console.log(`${tag} PASO C: generating snapshots for ${companies.length} companies.`);

  await Promise.all(
    companies.map(async (company) => {
      try {
        await generarSnapshotMensual(company.id, mes, anio);
        snapshotsGenerados++;
      } catch (err) {
        const msg = `Snapshot ${company.name}: ${err instanceof Error ? err.message : String(err)}`;
        errores.push(msg);
        console.error(`${tag} ${msg}`);
        Sentry.captureException(err, { tags: { job: "cierre-mensual", step: "snapshot" }, extra: { companyId: company.id } });
      }
    }),
  );

  console.log(`${tag} PASO C: ${snapshotsGenerados}/${companies.length} snapshots generated.`);

  // ─────────────────────────────────────────────────────────────────────────
  // PASO D — Generar informe narrativo (Claude API — non-blocking on error)
  // ─────────────────────────────────────────────────────────────────────────
  let informesGenerados = 0;
  console.log(`${tag} PASO D: generating narrative reports for ${companies.length} companies.`);

  for (const company of companies) {
    try {
      await generarInformeNarrativo({ companyId: company.id, mes, anio, actorId: "system" });
      informesGenerados++;
    } catch (err) {
      const msg = `Informe ${company.name}: ${err instanceof Error ? err.message : String(err)}`;
      errores.push(msg);
      console.error(`${tag} ${msg}`);
      Sentry.captureException(err, { tags: { job: "cierre-mensual", step: "informe" }, extra: { companyId: company.id } });
    }
  }

  console.log(`${tag} PASO D: ${informesGenerados}/${companies.length} reports generated.`);

  // ─────────────────────────────────────────────────────────────────────────
  // PASO E — Enviar emails por departamento
  // ─────────────────────────────────────────────────────────────────────────
  let emailsEnviados = 0;
  let emailsOmitidos = 0;
  let emailsErrores  = 0;
  console.log(`${tag} PASO E: sending department emails.`);

  for (const company of companies) {
    try {
      const result = await enviarResumenMensualEmpresa(company.id, mes, anio);
      emailsEnviados += result.enviados;
      emailsOmitidos += result.omitidos;
      emailsErrores  += result.errores;
    } catch (err) {
      const msg = `Emails ${company.name}: ${err instanceof Error ? err.message : String(err)}`;
      errores.push(msg);
      console.error(`${tag} ${msg}`);
      Sentry.captureException(err, { tags: { job: "cierre-mensual", step: "email" }, extra: { companyId: company.id } });
    }
  }

  console.log(`${tag} PASO E: ${emailsEnviados} sent, ${emailsOmitidos} skipped, ${emailsErrores} errors.`);

  // ─────────────────────────────────────────────────────────────────────────
  // PASO F — Registrar en AuditLog (per company, best-effort)
  // ─────────────────────────────────────────────────────────────────────────
  const payload = { mes, anio, viajesLiquidados, snapshotsGenerados, informesGenerados, emailsEnviados, errores: errores.length };

  await Promise.allSettled(
    companies.map((company) =>
      logAction({
        companyId:  company.id,
        actorId:    undefined,
        action:     "CIERRE_MENSUAL_COMPLETADO",
        entityType: "Company",
        entityId:   company.id,
        payload,
      }),
    ),
  );

  console.log(`${tag} DONE — ${viajesLiquidados} liquidados, ${snapshotsGenerados} snapshots, ${informesGenerados} informes, ${emailsEnviados} emails. ${errores.length} non-fatal errors.`);

  return NextResponse.json({
    data: {
      mes,
      anio,
      viajesLiquidados,
      snapshotsGenerados,
      informesGenerados,
      emailsEnviados,
      emailsOmitidos,
      emailsErrores,
      errores,
    },
  });
}
