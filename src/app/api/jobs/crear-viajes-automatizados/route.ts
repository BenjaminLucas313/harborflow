// =============================================================================
// POST /api/jobs/crear-viajes-automatizados
// =============================================================================
//
// Daily cron job that auto-creates the next day's trip for every Trip with
// automatizado = true.
//
// Logic per template trip:
//   1. Parse horaRecurrente ("HH:MM", Argentina UTC-3) → build next-day DateTime in UTC.
//   2. Check idempotency: if a trip for that boat + branchId already exists within
//      ±30 min of the target time on the target day, skip (already created).
//   3. Create a new trip copying: companyId, branchId, boatId, driverId, capacity,
//      waitlistEnabled, notes. Mark automatizado = true, horaRecurrente = same.
//   4. Write TRIP_CREATED audit record.
//
// SECURITY: X-Job-Secret header required (JOB_SECRET env var).
// IDEMPOTENCY: safe to call multiple times per day.
//
// RESPONSE
//   200 { data: { created: number; skipped: number } }
//   401 UNAUTHORIZED
//   500 INTERNAL_ERROR
//
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import * as Sentry                   from "@sentry/nextjs";
import { prisma }                    from "@/lib/prisma";
import { logAction }                 from "@/modules/audit/repository";

const ARG_OFFSET_HOURS = -3; // UTC-3, no DST

/** Convert "HH:MM" Argentina time for a given UTC date to a UTC Date. */
function buildArgDateTime(utcDateBase: Date, horaRecurrente: string): Date {
  const [hh, mm] = horaRecurrente.split(":").map(Number);
  // Build a Date for tomorrow in UTC, then adjust for Argentina offset.
  const next = new Date(utcDateBase);
  next.setUTCDate(next.getUTCDate() + 1);
  next.setUTCHours((hh ?? 0) - ARG_OFFSET_HOURS, mm ?? 0, 0, 0);
  return next;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const jobSecret = process.env["JOB_SECRET"];
  if (!jobSecret) {
    console.error("[crear-viajes-automatizados] JOB_SECRET not set.");
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

  // ── Main logic ────────────────────────────────────────────────────────────────
  try {
  // ── Find all template trips ──────────────────────────────────────────────────
  //
  // Key design decisions:
  //
  // 1. CANCELLED is the only excluded status.
  //    Excluding DEPARTED/COMPLETED broke the chain: once today's automated trip
  //    departed, the job had no template to base tomorrow's trip on.
  //    A DEPARTED trip still carries valid metadata (boat, branch, hora) — we just
  //    need it as a data source, not as an active trip.
  //
  // 2. distinct: ["boatId", "branchId", "horaRecurrente"] + orderBy desc.
  //    Prevents the template list from growing linearly as automated trips
  //    accumulate. We get exactly ONE row per schedule — the most recent — so
  //    the idempotency check is the only deduplication needed.
  const templates = await prisma.trip.findMany({
    where: {
      automatizado:   true,
      horaRecurrente: { not: null },
      // Only respect the explicit cancellation signal from the proveedor.
      status: { not: "CANCELLED" },
    },
    select: {
      id:              true,
      companyId:       true,
      branchId:        true,
      boatId:          true,
      driverId:        true,
      capacity:        true,
      waitlistEnabled: true,
      notes:           true,
      horaRecurrente:  true,
    },
    orderBy: { departureTime: "desc" },
    // Deduplicate at DB level: one template per (boat × branch × hora) combo.
    distinct: ["boatId", "branchId", "horaRecurrente"],
  });

  const now = new Date();
  let created = 0;
  let skipped = 0;

  for (const tpl of templates) {
    const horaRecurrente = tpl.horaRecurrente!;
    const targetTime = buildArgDateTime(now, horaRecurrente);

    // Idempotency check: existing trip within ±30 min for same boat + branch.
    const windowMs = 30 * 60 * 1000;
    const windowStart = new Date(targetTime.getTime() - windowMs);
    const windowEnd   = new Date(targetTime.getTime() + windowMs);

    const existing = await prisma.trip.findFirst({
      where: {
        companyId:     tpl.companyId,
        boatId:        tpl.boatId,
        branchId:      tpl.branchId,
        departureTime: { gte: windowStart, lte: windowEnd },
      },
      select: { id: true },
    });

    if (existing) {
      skipped++;
      continue;
    }

    // Create the new trip.
    const newTrip = await prisma.trip.create({
      data: {
        companyId:       tpl.companyId,
        branchId:        tpl.branchId,
        boatId:          tpl.boatId,
        driverId:        tpl.driverId,
        departureTime:   targetTime,
        capacity:        tpl.capacity,
        waitlistEnabled: tpl.waitlistEnabled,
        notes:           tpl.notes,
        automatizado:    true,
        horaRecurrente:  horaRecurrente,
      },
      select: { id: true, departureTime: true },
    });

    await logAction({
      companyId:  tpl.companyId,
      actorId:    "system-job",
      action:     "TRIP_CREATED",
      entityType: "Trip",
      entityId:   newTrip.id,
      payload: {
        sourceTemplateId: tpl.id,
        boatId:           tpl.boatId,
        branchId:         tpl.branchId,
        departureTime:    newTrip.departureTime.toISOString(),
        automatizado:     true,
      },
    });

    created++;
  }

  console.log(`[crear-viajes-automatizados] templates=${templates.length} created=${created} skipped=${skipped}`);
  return NextResponse.json({ data: { created, skipped } });
  } catch (err) {
    console.error("[crear-viajes-automatizados] unexpected error:", err);
    Sentry.captureException(err, { tags: { job: "crear-viajes-automatizados" } });
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Error interno del servidor." } },
      { status: 500 },
    );
  }
}
