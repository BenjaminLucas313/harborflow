// TripRequest service — on-demand boat request flow (EMPRESA → PROVEEDOR).
//
// Three core operations:
//   createTripRequest:          EMPRESA submits a request (PENDING)
//   reviewTripRequest:          PROVEEDOR accepts (→ FULFILLED, Trip auto-created) or rejects (→ REJECTED)
//   cancelTripRequestByOwner:   EMPRESA cancels own request (within cancellation window)

import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { logAction } from "@/modules/audit/repository";
import {
  checkSelfCancellation,
  CANCELLATION_MESSAGES,
} from "@/lib/cancellation-policy";
import {
  createTripRequest as repoCreate,
  findTripRequestById,
  updateTripRequest,
  listTripRequestsByRequester,
  listTripRequestsByCompany,
} from "./repository";
import type { TripRequestWithRelations } from "./repository";
import type { CreateTripRequestInput, ReviewTripRequestInput } from "./schema";

// ---------------------------------------------------------------------------
// Create (EMPRESA)
// ---------------------------------------------------------------------------

/**
 * Creates a PENDING TripRequest on behalf of an EMPRESA user.
 * origin/destination are free-text fields — no branch required.
 */
export async function createTripRequest(
  input: CreateTripRequestInput,
  ctx: {
    companyId:     string;
    requestedById: string;
  },
): Promise<TripRequestWithRelations> {
  if (!ctx.companyId) {
    throw new AppError("VALIDATION_ERROR", "companyId requerido para crear una solicitud.", 400);
  }

  // Verify the company actually exists before the nested connect — gives a
  // clear error instead of a Prisma "No record found" panic.
  const companyExists = await prisma.company.findUnique({
    where:  { id: ctx.companyId },
    select: { id: true },
  });
  if (!companyExists) {
    console.error(`[createTripRequest] Company not found: companyId=${ctx.companyId}`);
    throw new AppError(
      "NOT_FOUND",
      "Empresa no encontrada. Tu sesión puede estar desactualizada — cerrá sesión y volvé a ingresar.",
      404,
    );
  }

  console.log(`[createTripRequest] companyId=${ctx.companyId} requestedById=${ctx.requestedById}`);

  const request = await repoCreate({
    companyId:      ctx.companyId,
    origin:         input.origin,
    destination:    input.destination,
    requestedDate:  input.requestedDate,
    passengerCount: input.passengerCount,
    notes:          input.notes,
    requestedById:  ctx.requestedById,
  });

  logAction({
    companyId:  ctx.companyId,
    actorId:    ctx.requestedById,
    action:     "TRIP_REQUEST_CREATED",
    entityType: "TripRequest",
    entityId:   request.id,
    payload:    {
      origin:         input.origin,
      destination:    input.destination,
      requestedDate:  input.requestedDate.toISOString(),
      passengerCount: input.passengerCount,
    },
  }).catch(() => {});

  return request;
}

// ---------------------------------------------------------------------------
// Review (PROVEEDOR)
// ---------------------------------------------------------------------------

/**
 * PROVEEDOR accepts or rejects a TripRequest.
 *
 * On ACCEPT:
 *   - Validates the boat (active, same company).
 *   - Creates a Trip inside a transaction (snapshotting boat.capacity).
 *   - Updates TripRequest: status → FULFILLED, boatId, tripId, reviewedById, reviewedAt.
 *
 * On REJECT:
 *   - Updates TripRequest: status → REJECTED, rejectionNote, reviewedById, reviewedAt.
 *
 * Throws:
 *   NOT_FOUND (404)       — request, or boat not found / inactive
 *   VALIDATION_ERROR (400) — request is not PENDING
 */
export async function reviewTripRequest(
  requestId: string,
  input:     ReviewTripRequestInput,
  ctx: {
    companyId:   string;
    reviewedById: string;
  },
): Promise<TripRequestWithRelations> {
  const request = await findTripRequestById(requestId, ctx.companyId);
  if (!request) {
    throw new AppError("NOT_FOUND", "Solicitud no encontrada.", 404);
  }

  if (request.status !== "PENDING") {
    throw new AppError(
      "VALIDATION_ERROR",
      "Solo se pueden revisar solicitudes en estado pendiente.",
      400,
    );
  }

  // ── REJECT ──────────────────────────────────────────────────────────────────
  if (input.action === "REJECT") {
    const updated = await updateTripRequest(requestId, {
      status:        "REJECTED",
      rejectionNote: input.rejectionNote,
      reviewedById:  ctx.reviewedById,
      reviewedAt:    new Date(),
    });

    logAction({
      companyId:  ctx.companyId,
      actorId:    ctx.reviewedById,
      action:     "TRIP_REQUEST_REJECTED",
      entityType: "TripRequest",
      entityId:   requestId,
      payload:    { rejectionNote: input.rejectionNote },
    }).catch(() => {});

    return updated;
  }

  // ── ACCEPT ──────────────────────────────────────────────────────────────────
  // Validate the boat — active, same company.
  const boat = await prisma.boat.findFirst({
    where: { id: input.boatId!, companyId: ctx.companyId, isActive: true },
    select: { id: true, branchId: true, capacity: true },
  });
  if (!boat) {
    throw new AppError("NOT_FOUND", "Embarcación no encontrada o inactiva.", 404);
  }

  // Create Trip + update TripRequest atomically.
  const updatedRequest = await prisma.$transaction(async (tx) => {
    // Create the trip with snapshotted capacity.
    const trip = await tx.trip.create({
      data: {
        companyId:       ctx.companyId,
        branchId:        boat.branchId,
        boatId:          boat.id,
        departureTime:   request.requestedDate,
        capacity:        boat.capacity,
        waitlistEnabled: false,
        notes:           request.notes ?? undefined,
      },
      select: { id: true },
    });

    // Update the TripRequest to FULFILLED.
    return tx.tripRequest.update({
      where: { id: requestId },
      data: {
        status:       "FULFILLED",
        boatId:       boat.id,
        tripId:       trip.id,
        reviewedById: ctx.reviewedById,
        reviewedAt:   new Date(),
      },
      select: {
        id: true, companyId: true, branchId: true,
        origin: true, destination: true, requestedDate: true,
        passengerCount: true, notes: true, status: true,
        requestedById: true, boatId: true, tripId: true,
        reviewedById: true, reviewedAt: true, rejectionNote: true,
        createdAt: true, updatedAt: true,
        requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        boat:        { select: { id: true, name: true, capacity: true } },
        reviewedBy:  { select: { id: true, firstName: true, lastName: true } },
      },
    });
  });

  logAction({
    companyId:  ctx.companyId,
    actorId:    ctx.reviewedById,
    action:     "TRIP_REQUEST_ACCEPTED",
    entityType: "TripRequest",
    entityId:   requestId,
    payload:    {
      boatId: boat.id,
      tripId: updatedRequest.tripId,
    },
  }).catch(() => {});

  return updatedRequest as unknown as TripRequestWithRelations;
}

// ---------------------------------------------------------------------------
// Cancel (EMPRESA — self-service)
// ---------------------------------------------------------------------------

/**
 * Cancels a TripRequest on behalf of the EMPRESA user who created it.
 *
 * Steps:
 *   1. Fetch the request — must exist and belong to the caller's company.
 *   2. Verify ownership: requestedById === actorId.
 *   3. Guard against already-terminal states (REJECTED, CANCELLED).
 *   4. Determine the effective departure time:
 *        - FULFILLED → use the linked Trip.departureTime
 *        - PENDING   → use requestedDate (the intended trip date)
 *   5. Check self-cancellation policy (2h window).
 *   6. Transaction:
 *        a. Mark TripRequest as CANCELLED.
 *        b. If FULFILLED (has tripId): cancel all GroupBookings for this company
 *           on that trip, including ALL their slots (PENDING + CONFIRMED).
 *           This removes any UABL-approved seats for this company.
 *   7. Audit log.
 *
 * Throws:
 *   TRIP_REQUEST_NOT_FOUND (404)         — request missing or wrong company/owner
 *   TRIP_REQUEST_NOT_CANCELLABLE (409)   — already REJECTED or CANCELLED
 *   CANCELLATION_TOO_LATE (422)          — within 2h or past departure
 */
export async function cancelTripRequestByOwner(
  requestId:          string,
  actorId:            string,
  companyId:          string,
  motivoCancelacion?: string,
): Promise<TripRequestWithRelations> {
  // 1. Fetch with ownership check.
  const request = await findTripRequestById(requestId, companyId);
  if (!request) {
    throw new AppError("TRIP_REQUEST_NOT_FOUND", "Solicitud no encontrada.", 404);
  }

  // 2. Ownership — only the requester can self-cancel.
  if (request.requestedById !== actorId) {
    throw new AppError("TRIP_REQUEST_NOT_FOUND", "Solicitud no encontrada.", 404);
  }

  // 3. Terminal states cannot be cancelled again.
  if (request.status === "REJECTED" || request.status === "CANCELLED") {
    throw new AppError(
      "TRIP_REQUEST_NOT_CANCELLABLE",
      "La solicitud ya fue rechazada o cancelada y no puede modificarse.",
      409,
    );
  }

  // 4. Determine departure time for policy check.
  let departureTime: Date;
  if (request.status === "FULFILLED" && request.tripId) {
    const trip = await prisma.trip.findUnique({
      where:  { id: request.tripId },
      select: { departureTime: true },
    });
    departureTime = trip?.departureTime ?? request.requestedDate;
  } else {
    departureTime = request.requestedDate;
  }

  // 5. Cancellation policy check.
  const check = checkSelfCancellation(departureTime);
  if (!check.allowed) {
    throw new AppError(
      "CANCELLATION_TOO_LATE",
      CANCELLATION_MESSAGES[check.reason],
      422,
    );
  }

  // 6. Atomic cancellation.
  await prisma.$transaction(async (tx) => {
    // 6a. Cancel the TripRequest.
    await tx.tripRequest.update({
      where: { id: requestId },
      data:  {
        status: "CANCELLED",
        ...(motivoCancelacion ? { motivoCancelacion } : {}),
      },
    });

    // 6b. If the request was already FULFILLED, cancel all GroupBookings
    //     created by this company for the associated trip, including their
    //     PENDING and CONFIRMED slots (removes UABL-approved seats too).
    if (request.status === "FULFILLED" && request.tripId) {
      const bookings = await tx.groupBooking.findMany({
        where:  { tripId: request.tripId, companyId },
        select: { id: true },
      });

      const bookingIds = bookings.map((b) => b.id);

      if (bookingIds.length > 0) {
        // Cancel ALL slots (PENDING + CONFIRMED) — full retraction from UABL.
        await tx.passengerSlot.updateMany({
          where: {
            groupBookingId: { in: bookingIds },
            status:         { in: ["PENDING", "CONFIRMED"] },
          },
          data: { status: "CANCELLED" },
        });

        await tx.groupBooking.updateMany({
          where: { id: { in: bookingIds } },
          data:  { status: "CANCELLED" },
        });
      }
    }
  });

  // 7. Audit — best-effort.
  logAction({
    companyId,
    actorId,
    action:     "TRIP_REQUEST_CANCELLED",
    entityType: "TripRequest",
    entityId:   requestId,
    payload:    {
      status:             request.status,
      tripId:             request.tripId ?? null,
      motivoCancelacion:  motivoCancelacion ?? null,
    },
  }).catch(() => {});

  // Return fresh record to reflect new CANCELLED status.
  return (await findTripRequestById(requestId, companyId))!;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export { listTripRequestsByRequester, listTripRequestsByCompany, findTripRequestById };
