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

  // ── Find all template trips ──────────────────────────────────────────────────
  const templates = await prisma.trip.findMany({
    where: {
      automatizado: true,
      horaRecurrente: { not: null },
      // Only use active (non-terminal) templates so cancelled trips don't keep spawning.
      status: { notIn: ["CANCELLED", "DEPARTED", "COMPLETED"] },
    },
    select: {
      id:               true,
      companyId:        true,
      branchId:         true,
      boatId:           true,
      driverId:         true,
      capacity:         true,
      waitlistEnabled:  true,
      notes:            true,
      horaRecurrente:   true,
    },
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
}
