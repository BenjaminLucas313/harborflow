// Trip service: create, update, status transitions. Snapshots boat.capacity at creation time.

import { TripStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { logAction } from "@/modules/audit/repository";
import { isDatePast } from "@/lib/date-utils";
import {
  createTrip as repoCreateTrip,
  listTripsByBranch as repoListTripsByBranch,
} from "./repository";
import type { TripRow, ListTripsFilter } from "./repository";
import type { CreateTripInput } from "./schema";

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export type CreateTripServiceInput = Omit<CreateTripInput, "companyId"> & {
  /** companyId is required at the service layer — always set from session, never from the client. */
  companyId: string;
  actorId: string;
};

/**
 * Creates a scheduled trip.
 *
 * Steps:
 *   1. Fetch the boat — must be active and belong to the same company+branch.
 *   2. If a driver is specified, validate it too.
 *   3. Snapshot boat.capacity onto the trip (design principle: edits to the
 *      boat must not retroactively affect existing trips).
 *   4. Insert the trip.
 *   5. Write a TRIP_CREATED audit record.
 *
 * Throws:
 *   NOT_FOUND (404)       — boat or driver not found / inactive
 *   VALIDATION_ERROR (400) — boat or driver belongs to a different branch
 */
export async function createTrip(
  input: CreateTripServiceInput,
): Promise<TripRow> {
  const { actorId, ...tripInput } = input;

  // 0. Validate departure time — must not be in the past.
  if (isDatePast(tripInput.departureTime)) {
    throw new AppError(
      "TRIP_DEPARTURE_PAST",
      "La fecha de salida no puede estar en el pasado.",
      400,
    );
  }

  // 1. Validate boat — active, same company, same branch.
  const boat = await prisma.boat.findFirst({
    where: {
      id: tripInput.boatId,
      companyId: tripInput.companyId,
      isActive: true,
    },
    select: { id: true, branchId: true, capacity: true },
  });

  if (!boat) {
    throw new AppError("NOT_FOUND", "Boat not found or inactive.", 404);
  }

  if (boat.branchId !== tripInput.branchId) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Boat does not belong to the specified branch.",
      400,
    );
  }

  // 2. Validate driver if provided — active, same company, same branch.
  if (tripInput.driverId) {
    const driver = await prisma.driver.findFirst({
      where: {
        id: tripInput.driverId,
        companyId: tripInput.companyId,
        branchId: tripInput.branchId,
        isActive: true,
      },
      select: { id: true },
    });

    if (!driver) {
      throw new AppError("NOT_FOUND", "Driver not found or inactive.", 404);
    }
  }

  // 3. Insert trip with snapshotted capacity.
  const trip = await repoCreateTrip({
    companyId: tripInput.companyId,
    branchId: tripInput.branchId,
    boatId: tripInput.boatId,
    driverId: tripInput.driverId,
    departureTime: tripInput.departureTime,
    estimatedArrivalTime: tripInput.estimatedArrivalTime,
    capacity: boat.capacity,
    waitlistEnabled: tripInput.waitlistEnabled,
    notes: tripInput.notes,
    automatizado: tripInput.automatizado,
    horaRecurrente: tripInput.horaRecurrente,
  });

  // 4. Audit trail — non-blocking best-effort; failure logged, not surfaced.
  await logAction({
    companyId: tripInput.companyId,
    actorId,
    action: "TRIP_CREATED",
    entityType: "Trip",
    entityId: trip.id,
    payload: {
      boatId: trip.boatId,
      branchId: trip.branchId,
      departureTime: trip.departureTime.toISOString(),
      capacity: trip.capacity,
      waitlistEnabled: trip.waitlistEnabled,
    },
  });

  return trip;
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export type ListTripsQuery = {
  branchId: string;
  /** UTC date to filter by. Service computes the full-day window [00:00, 24:00). */
  date?: Date;
  /** If omitted, defaults to non-terminal statuses (SCHEDULED, BOARDING, DELAYED). */
  status?: TripStatus;
};

export async function listTripsByBranch(
  query: ListTripsQuery,
): Promise<TripRow[]> {
  const filter: ListTripsFilter = {
    branchId: query.branchId,
    status: query.status,
  };

  if (query.date) {
    const dayStart = new Date(query.date);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
    filter.dayStart = dayStart;
    filter.dayEnd = dayEnd;
  }

  return repoListTripsByBranch(filter);
}
