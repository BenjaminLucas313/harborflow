// Reservation service: booking, listing.
//
// CAPACITY ENFORCEMENT
// --------------------
// The bookTrip function acquires a row-level lock on the Trip record
// (SELECT ... FOR UPDATE) before counting seats and inserting. This serialises
// concurrent booking attempts for the same trip and prevents the last-seat race.
//
// SINGLE-ACTIVE-RESERVATION INVARIANT
// ------------------------------------
// A user may hold at most one active reservation (CONFIRMED / CHECKED_IN /
// WAITLISTED) at a time. The DB enforces this via a partial unique index:
//   reservation_one_active_per_user ON "Reservation" (userId, companyId)
//   WHERE status IN ('CONFIRMED', 'WAITLISTED', 'CHECKED_IN')
// The service also performs a pre-check so the error message is friendly.
// The full replacement flow (switching trips) is a separate feature.
//
// WAITLIST
// --------
// When a trip is full and waitlist is enabled, a WaitlistEntry is created
// with position = MAX(position) + 1, computed inside the same transaction.

import { Prisma, TripStatus, ReservationStatus, WaitlistStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { logAction } from "@/modules/audit/repository";
import { isTripAvailable } from "@/lib/date-utils";
import {
  RESERVATION_SELECT,
  WAITLIST_SELECT,
  findActiveReservationByUserAndTrip,
  findReservationById,
  findWaitlistEntryById,
  listReservationsByUser as repoListByUser,
  listReservationsByTrip as repoListByTrip,
} from "./repository";
import type { ReservationRow, WaitlistEntryRow } from "./repository";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Trip statuses that accept new reservations. */
const BOOKABLE_STATUSES: TripStatus[] = [
  TripStatus.SCHEDULED,
  TripStatus.BOARDING,
  TripStatus.DELAYED,
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BookingResult =
  | { type: "CONFIRMED"; reservation: ReservationRow }
  | { type: "WAITLISTED"; waitlistEntry: WaitlistEntryRow };

export type BookTripInput = {
  tripId: string;
  userId: string;
  companyId: string;
};

// ---------------------------------------------------------------------------
// Book a trip
// ---------------------------------------------------------------------------

/**
 * Creates a CONFIRMED reservation or a WAITLISTED queue entry.
 *
 * Steps:
 *   1. Fetch trip — must exist in company and be in a bookable status.
 *   2. Check for an existing active reservation for this user+trip.
 *   3. Open a transaction:
 *      a. Lock the Trip row (FOR UPDATE) to serialise concurrent bookings.
 *      b. Count seats already consumed (CONFIRMED + CHECKED_IN).
 *      c. Seat available → insert CONFIRMED Reservation.
 *      d. No seat, waitlist enabled → insert WaitlistEntry at next position.
 *      e. No seat, waitlist disabled → throw WAITLIST_NOT_ENABLED.
 *   4. Write audit record (best-effort, non-blocking).
 *
 * Throws:
 *   TRIP_NOT_FOUND (404)           — trip missing or wrong company
 *   TRIP_NOT_BOOKABLE (409)        — terminal trip status
 *   RESERVATION_ALREADY_ACTIVE (409) — duplicate booking for this trip
 *   WAITLIST_NOT_ENABLED (409)     — trip full, no waitlist
 */
export async function bookTrip(input: BookTripInput): Promise<BookingResult> {
  const { tripId, userId, companyId } = input;

  // 1. Validate trip outside the transaction — avoids holding a lock during
  //    unnecessary round-trips.
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, companyId },
    select: {
      id: true,
      branchId: true,
      status: true,
      capacity: true,
      waitlistEnabled: true,
      departureTime: true,
    },
  });

  if (!trip) {
    throw new AppError("TRIP_NOT_FOUND", "Trip not found.", 404);
  }

  if (!BOOKABLE_STATUSES.includes(trip.status)) {
    throw new AppError(
      "TRIP_NOT_BOOKABLE",
      "This trip is not open for reservations.",
      409,
    );
  }

  // Reject reservations for trips departing in less than 1 hour.
  if (!isTripAvailable(trip.departureTime)) {
    throw new AppError(
      "TRIP_DEPARTURE_TOO_SOON",
      "No se puede reservar este viaje: la salida es en menos de 1 hora o ya pasó.",
      400,
    );
  }

  // 2. Pre-check for duplicate reservation on this specific trip.
  const existing = await findActiveReservationByUserAndTrip(userId, tripId);
  if (existing) {
    throw new AppError(
      "RESERVATION_ALREADY_ACTIVE",
      "You already have a reservation for this trip.",
      409,
    );
  }

  // ---------------------------------------------------------------------------
  // 3. Transactional capacity check + insert
  // ---------------------------------------------------------------------------

  // Raw query row types
  type TripLockRow = { id: string; capacity: number; waitlistEnabled: boolean };
  type CountRow = { count: bigint };
  type MaxPosRow = { maxPos: number | null };

  let result: BookingResult;

  try {
    result = await prisma.$transaction(async (tx) => {
      // 3a. Lock the trip row so no other transaction can book concurrently.
      const [locked] = await tx.$queryRaw<TripLockRow[]>`
        SELECT id, capacity, "waitlistEnabled"
        FROM "Trip"
        WHERE id = ${tripId}
        FOR UPDATE
      `;

      // Should not happen (we checked above), but guard for safety.
      if (!locked) {
        throw new AppError("TRIP_NOT_FOUND", "Trip not found.", 404);
      }

      // 3b. Count seats consumed by CONFIRMED and CHECKED_IN reservations.
      //     WAITLISTED entries do not consume capacity (schema design principle).
      //     COUNT(*) always returns exactly one row; the non-null assertion is safe.
      const countRows = await tx.$queryRaw<CountRow[]>`
        SELECT COUNT(*) AS count
        FROM "Reservation"
        WHERE "tripId" = ${tripId}
        AND status IN ('CONFIRMED', 'CHECKED_IN')
      `;
      const takenSeats = Number(countRows[0]?.count ?? 0);

      if (takenSeats < locked.capacity) {
        // 3c. Seat available — create a CONFIRMED reservation.
        const reservation = await tx.reservation.create({
          data: {
            companyId,
            branchId: trip.branchId,
            userId,
            tripId,
            status: ReservationStatus.CONFIRMED,
          },
          select: RESERVATION_SELECT,
        });
        return { type: "CONFIRMED" as const, reservation };
      }

      // 3d. Trip is full.
      if (!locked.waitlistEnabled) {
        throw new AppError(
          "WAITLIST_NOT_ENABLED",
          "This trip is full and the waitlist is not enabled.",
          409,
        );
      }

      // 3e. Compute next waitlist position inside the lock.
      //     MAX returns one row; result is null when the table has no entries yet.
      const maxPosRows = await tx.$queryRaw<MaxPosRow[]>`
        SELECT MAX(position) AS "maxPos"
        FROM "WaitlistEntry"
        WHERE "tripId" = ${tripId}
      `;
      const position = (maxPosRows[0]?.maxPos ?? 0) + 1;

      const waitlistEntry = await tx.waitlistEntry.create({
        data: {
          companyId,
          branchId: trip.branchId,
          userId,
          tripId,
          position,
          status: WaitlistStatus.WAITING,
        },
        select: WAITLIST_SELECT,
      });
      return { type: "WAITLISTED" as const, waitlistEntry };
    });
  } catch (err) {
    // The partial unique index reservation_one_active_per_user fires when the
    // user already has an active reservation on a different trip (single-active
    // invariant). Map the constraint violation to a friendly error.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new AppError(
        "RESERVATION_ALREADY_ACTIVE",
        "You already have an active reservation. Cancel it before booking a new trip.",
        409,
      );
    }
    throw err;
  }

  // 4. Audit log — best-effort; failure must not roll back the booking.
  const entityId =
    result.type === "CONFIRMED"
      ? result.reservation.id
      : result.waitlistEntry.id;

  logAction({
    companyId,
    actorId: userId,
    action:
      result.type === "CONFIRMED"
        ? "RESERVATION_CREATED"
        : "WAITLIST_JOINED",
    entityType: result.type === "CONFIRMED" ? "Reservation" : "WaitlistEntry",
    entityId,
    payload: { tripId, userId, type: result.type },
  }).catch(() => {
    // Audit failures are silent — the booking succeeded.
  });

  return result;
}

// ---------------------------------------------------------------------------
// Cancel a confirmed reservation — with automatic waitlist promotion
// ---------------------------------------------------------------------------

export type CancellationResult = {
  cancelled: ReservationRow;
  /** The reservation created for the promoted waitlist user, or null if the
   *  waitlist was empty or the promoted user was no longer eligible. */
  promoted: ReservationRow | null;
};

export type CancelReservationInput = {
  reservationId: string;
  userId: string;
  companyId: string;
};

/**
 * Cancels a passenger's CONFIRMED reservation.
 *
 * Steps:
 *   1. Verify the reservation exists and belongs to the caller.
 *   2. Verify it is in a cancellable state (CONFIRMED only; CHECKED_IN
 *      cannot be reversed without an operator action).
 *   3. Open a transaction:
 *      a. Lock the Trip row (FOR UPDATE) — prevents concurrent bookings
 *         from racing with the seat that is about to become available.
 *      b. Mark the reservation CANCELLED.
 *      c. Find the first WAITING WaitlistEntry for this trip (lowest position).
 *      d. If found, create a CONFIRMED reservation for that user and mark the
 *         WaitlistEntry as PROMOTED.  If the promoted user's unique-index guard
 *         fires (they already have an active reservation on another trip),
 *         promotion is silently skipped — the seat stays open.
 *   4. Write audit records (best-effort).
 *
 * Throws:
 *   RESERVATION_NOT_FOUND (404)         — wrong id, wrong user, or wrong company
 *   RESERVATION_ALREADY_CANCELLED (409) — status is not CONFIRMED
 */
export async function cancelReservation(
  input: CancelReservationInput,
): Promise<CancellationResult> {
  const { reservationId, userId, companyId } = input;

  // 1 & 2. Ownership + status check outside the transaction.
  const reservation = await findReservationById(reservationId, userId, companyId);

  if (!reservation) {
    throw new AppError("RESERVATION_NOT_FOUND", "Reservation not found.", 404);
  }

  if (reservation.status !== ReservationStatus.CONFIRMED) {
    throw new AppError(
      "RESERVATION_ALREADY_CANCELLED",
      "Only CONFIRMED reservations can be cancelled.",
      409,
    );
  }

  const tripId = reservation.tripId;

  // Raw query row type for the waitlist lock query.
  type WaitlistLockRow = {
    id: string;
    userId: string;
    companyId: string;
    branchId: string;
    position: number;
  };

  let promoted: ReservationRow | null = null;

  // 3. Transactional cancellation + optional promotion.
  const cancelled = await prisma.$transaction(async (tx) => {
    // 3a. Lock the trip row — prevents new bookings from filling the seat
    //     before we finish the cancellation + promotion.
    await tx.$executeRaw`
      SELECT id FROM "Trip" WHERE id = ${tripId} FOR UPDATE
    `;

    // 3b. Mark the reservation as CANCELLED.
    const cancelledRow = await tx.reservation.update({
      where: { id: reservationId },
      data: { status: ReservationStatus.CANCELLED },
      select: RESERVATION_SELECT,
    });

    // 3c. Find the first WAITING entry (FIFO = lowest position).
    const waiting = await tx.$queryRaw<WaitlistLockRow[]>`
      SELECT id, "userId", "companyId", "branchId", position
      FROM "WaitlistEntry"
      WHERE "tripId" = ${tripId}
        AND status = 'WAITING'
      ORDER BY position ASC
      LIMIT 1
      FOR UPDATE
    `;

    if (waiting.length > 0) {
      const entry = waiting[0]!;

      try {
        // 3d. Create CONFIRMED reservation for the promoted user.
        const promotedRow = await tx.reservation.create({
          data: {
            companyId: entry.companyId,
            branchId: entry.branchId,
            userId: entry.userId,
            tripId,
            status: ReservationStatus.CONFIRMED,
          },
          select: RESERVATION_SELECT,
        });

        // Mark the WaitlistEntry as PROMOTED and link to the new reservation.
        await tx.waitlistEntry.update({
          where: { id: entry.id },
          data: {
            status: WaitlistStatus.PROMOTED,
            promotedToReservationId: promotedRow.id,
          },
        });

        promoted = promotedRow;
      } catch (promoteErr) {
        // P2002: the promoted user already has an active reservation on another
        // trip (single-active-reservation invariant).  Silently skip promotion —
        // the freed seat will be available for the next booking.
        if (
          !(
            promoteErr instanceof Prisma.PrismaClientKnownRequestError &&
            promoteErr.code === "P2002"
          )
        ) {
          throw promoteErr;
        }
      }
    }

    return cancelledRow;
  });

  // 4. Audit logs — best-effort, non-blocking.
  logAction({
    companyId,
    actorId: userId,
    action: "RESERVATION_CANCELLED",
    entityType: "Reservation",
    entityId: reservationId,
    payload: { tripId, userId },
  }).catch(() => {});

  if (promoted !== null) {
    const p = promoted as ReservationRow;
    logAction({
      companyId,
      // actorId omitted — promotion is system-triggered by the cancellation
      action: "WAITLIST_PROMOTED",
      entityType: "Reservation",
      entityId: p.id,
      payload: { tripId, userId: p.userId, promotedFromCancellation: reservationId },
    }).catch(() => {});
  }

  return { cancelled, promoted };
}

// ---------------------------------------------------------------------------
// Cancel a waitlist entry — with position repack
// ---------------------------------------------------------------------------

export type WaitlistCancellationResult = {
  cancelled: WaitlistEntryRow;
};

export type CancelWaitlistEntryInput = {
  entryId: string;
  userId: string;
  companyId: string;
};

/**
 * Removes a passenger from the waitlist.
 *
 * Steps:
 *   1. Verify the WaitlistEntry exists and belongs to the caller.
 *   2. Verify it is still WAITING.
 *   3. Transaction (trip locked):
 *      a. Mark the entry CANCELLED.
 *      b. Repack remaining WAITING positions using ROW_NUMBER() so the FIFO
 *         queue stays contiguous.  The CTE-based UPDATE evaluates the full set
 *         before applying changes, avoiding transient unique-constraint conflicts.
 *   4. Audit log (best-effort).
 *
 * Throws:
 *   RESERVATION_NOT_FOUND (404)         — entry not found or wrong ownership
 *   RESERVATION_ALREADY_CANCELLED (409) — entry is not WAITING
 */
export async function cancelWaitlistEntry(
  input: CancelWaitlistEntryInput,
): Promise<WaitlistCancellationResult> {
  const { entryId, userId, companyId } = input;

  // 1 & 2. Ownership + status check outside the transaction.
  const entry = await findWaitlistEntryById(entryId, userId, companyId);

  if (!entry) {
    throw new AppError("RESERVATION_NOT_FOUND", "Waitlist entry not found.", 404);
  }

  if (entry.status !== WaitlistStatus.WAITING) {
    throw new AppError(
      "RESERVATION_ALREADY_CANCELLED",
      "This waitlist entry is no longer active.",
      409,
    );
  }

  const tripId = entry.tripId;

  // 3. Transactional cancellation + repack.
  const cancelled = await prisma.$transaction(async (tx) => {
    // Lock the trip row so concurrent bookings don't interleave with the repack.
    await tx.$executeRaw`
      SELECT id FROM "Trip" WHERE id = ${tripId} FOR UPDATE
    `;

    // 3a. Cancel the entry.
    const cancelledRow = await tx.waitlistEntry.update({
      where: { id: entryId },
      data: { status: WaitlistStatus.CANCELLED },
      select: WAITLIST_SELECT,
    });

    // 3b. Repack remaining WAITING positions for this trip.
    //     ROW_NUMBER() assigns 1, 2, 3… ordered by the current position,
    //     so FIFO order is preserved.  PostgreSQL evaluates the CTE as a
    //     set operation — the unique constraint on (tripId, position) is
    //     checked after the full update, not row-by-row.
    await tx.$executeRaw`
      WITH ranked AS (
        SELECT id,
               ROW_NUMBER() OVER (ORDER BY position)::int AS new_pos
        FROM   "WaitlistEntry"
        WHERE  "tripId" = ${tripId}
          AND  status   = 'WAITING'
      )
      UPDATE "WaitlistEntry" e
      SET    position = ranked.new_pos
      FROM   ranked
      WHERE  e.id = ranked.id
    `;

    return cancelledRow;
  });

  // 4. Audit log — best-effort, non-blocking.
  logAction({
    companyId,
    actorId: userId,
    action: "WAITLIST_CANCELLED",
    entityType: "WaitlistEntry",
    entityId: entryId,
    payload: { tripId, userId },
  }).catch(() => {});

  return { cancelled };
}

// ---------------------------------------------------------------------------
// List — passenger view
// ---------------------------------------------------------------------------

export async function listReservationsByUser(
  userId: string,
  companyId: string,
): Promise<ReservationRow[]> {
  return repoListByUser(userId, companyId);
}

// ---------------------------------------------------------------------------
// List — operator / admin view
// ---------------------------------------------------------------------------

export async function listReservationsByTrip(
  tripId: string,
  companyId: string,
): Promise<ReservationRow[]> {
  return repoListByTrip(tripId, companyId);
}
