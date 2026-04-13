// =============================================================================
// update-past-trips — background job
// =============================================================================
//
// Marks trips whose departureTime has passed as PASADO (viajeStatus).
//
// A trip is eligible when ALL of the following are true:
//   • viajeStatus = ACTIVO          (not already settled or cancelled)
//   • departureTime < NOW (UTC)     (the scheduled departure is in the past)
//   • status IN (DEPARTED, COMPLETED, CANCELLED)
//       OR departureTime older than the grace period (default: 2 hours)
//
// GRACE PERIOD
// ------------
// Trips are not immediately flipped on the exact departure second — operators
// often mark status DEPARTED/COMPLETED slightly after departure. We allow a
// 2-hour grace window:
//   A trip is auto-PASADO when departureTime < NOW - 2h
// Trips completed/departed by the operator (status IN terminal set) are
// flipped immediately regardless of the grace window.
//
// IDEMPOTENCY
// -----------
// The job uses updateMany with { viajeStatus: { not: PASADO } } guards, so
// running it multiple times is safe.
//
// =============================================================================

import { TripStatus, ViajeStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type UpdatePastTripsResult = {
  markedPasado: number;
};

/** Statuses that mean the operator explicitly finished the trip. */
const OPERATOR_TERMINAL_STATUSES: TripStatus[] = [
  TripStatus.COMPLETED,
  TripStatus.DEPARTED,
  TripStatus.CANCELLED,
];

/** Grace period in milliseconds before an ACTIVO trip is auto-flipped. */
const GRACE_PERIOD_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Marks eligible trips as PASADO.
 *
 * Two update batches:
 *   1. Operator-terminal: status IN (COMPLETED, DEPARTED, CANCELLED) → PASADO immediately.
 *   2. Time-based: departureTime < NOW - 2h (regardless of operator status) → PASADO.
 *
 * Returns the total count of updated rows.
 */
export async function updatePastTrips(): Promise<UpdatePastTripsResult> {
  const now = new Date();
  const graceThreshold = new Date(now.getTime() - GRACE_PERIOD_MS);

  // Batch 1 — operator explicitly completed/departed/cancelled the trip.
  const operatorTerminal = await prisma.trip.updateMany({
    where: {
      viajeStatus: { not: ViajeStatus.PASADO },
      status: { in: OPERATOR_TERMINAL_STATUSES },
    },
    data: { viajeStatus: ViajeStatus.PASADO },
  });

  // Batch 2 — departure was more than 2 hours ago (regardless of status).
  const timeBased = await prisma.trip.updateMany({
    where: {
      viajeStatus: { not: ViajeStatus.PASADO },
      departureTime: { lt: graceThreshold },
    },
    data: { viajeStatus: ViajeStatus.PASADO },
  });

  return {
    markedPasado: operatorTerminal.count + timeBased.count,
  };
}
