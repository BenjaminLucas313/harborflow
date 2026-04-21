// Trip service: create, update, status transitions. Snapshots boat.capacity at creation time.

import { TripStatus, ViajeStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { logAction } from "@/modules/audit/repository";
import { isDatePast, formatArgDate } from "@/lib/date-utils";
import { crearNotificacion } from "@/modules/notificaciones/service";
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

// ---------------------------------------------------------------------------
// Cancel (with cascade)
// ---------------------------------------------------------------------------

export type CancelTripResult = {
  tripId:              string;
  groupBookingsCancelled: number;
  slotsCancelled:      number;
  /** userId list for downstream notification creation. */
  affectedUserIds:     string[];
};

/**
 * Cancels a trip and cascades the cancellation atomically:
 *   1. Trip status → CANCELLED, viajeStatus → CANCELADO
 *   2. All GroupBookings on this trip → CANCELLED
 *   3. All PassengerSlots on this trip (PENDING | CONFIRMED) → CANCELLED
 *
 * Returns the list of affected USUARIO ids so the caller can create
 * in-app notifications (kept outside the transaction to stay best-effort).
 *
 * Throws:
 *   NOT_FOUND (404)   — trip not found or wrong company
 *   CONFLICT (409)    — trip is already CANCELLED
 */
export async function cancelTrip(
  tripId:    string,
  companyId: string,
  actorId:   string,
  isDeleteRequest = false,
): Promise<CancelTripResult> {
  const trip = await prisma.trip.findFirst({
    where:  { id: tripId, companyId },
    select: {
      id:            true,
      status:        true,
      departureTime: true,
      boat:          { select: { name: true } },
    },
  });

  if (!trip) {
    throw new AppError("NOT_FOUND", "Viaje no encontrado.", 404);
  }
  if (trip.status === TripStatus.CANCELLED) {
    throw new AppError("TRIP_ALREADY_CANCELLED", "El viaje ya está cancelado.", 409);
  }

  // Collect affected slot users before the transaction.
  const affectedSlots = await prisma.passengerSlot.findMany({
    where:  { tripId, status: { in: ["PENDING", "CONFIRMED"] } },
    select: { usuarioId: true },
  });
  const affectedUserIds = [...new Set(affectedSlots.map((s) => s.usuarioId))];

  // Collect EMPRESA bookers (GroupBookings not yet cancelled).
  const affectedBookings = await prisma.groupBooking.findMany({
    where:  { tripId, status: { notIn: ["CANCELLED"] } },
    select: { bookedById: true },
  });
  const affectedBookerIds = [...new Set(affectedBookings.map((b) => b.bookedById))];

  // Atomic cascade.
  const [, gbResult, slotResult] = await prisma.$transaction([
    prisma.trip.update({
      where: { id: tripId },
      data:  { status: TripStatus.CANCELLED, viajeStatus: ViajeStatus.CANCELADO },
    }),
    prisma.groupBooking.updateMany({
      where: { tripId, status: { notIn: ["CANCELLED"] } },
      data:  { status: "CANCELLED" },
    }),
    prisma.passengerSlot.updateMany({
      where: { tripId, status: { in: ["PENDING", "CONFIRMED"] } },
      data:  { status: "CANCELLED" },
    }),
  ]);

  logAction({
    companyId,
    actorId,
    action:     "TRIP_STATUS_CHANGED",
    entityType: "Trip",
    entityId:   tripId,
    payload: {
      from:            trip.status,
      to:              "CANCELLED",
      groupBookingsCancelled: gbResult.count,
      slotsCancelled:  slotResult.count,
      ...(isDeleteRequest ? { isDeleteRequest: true } : {}),
    },
  }).catch(() => {});

  // Best-effort in-app notifications — never block the response.
  const fechaStr = formatArgDate(trip.departureTime);
  const boatName = trip.boat.name;

  for (const uid of affectedUserIds) {
    crearNotificacion({
      userId:    uid,
      companyId,
      tipo:      "VIAJE_CANCELADO",
      titulo:    "Viaje cancelado",
      mensaje:   `El viaje del ${fechaStr} en ${boatName} fue cancelado`,
      accionUrl: "/usuario/viajes",
    }).catch(() => {});
  }

  for (const uid of affectedBookerIds) {
    crearNotificacion({
      userId:    uid,
      companyId,
      tipo:      "GROUP_BOOKING_CANCELADO",
      titulo:    "Reserva grupal cancelada",
      mensaje:   `Tu reserva grupal para el ${fechaStr} fue cancelada`,
      accionUrl: "/empresa/reservas",
    }).catch(() => {});
  }

  return {
    tripId,
    groupBookingsCancelled: gbResult.count,
    slotsCancelled:         slotResult.count,
    affectedUserIds,
  };
}
