// TripRequest service — on-demand boat request flow (EMPRESA → PROVEEDOR).
//
// Two core operations:
//   createTripRequest: EMPRESA submits a request (PENDING)
//   reviewTripRequest: PROVEEDOR accepts (→ FULFILLED, Trip auto-created) or rejects (→ REJECTED)

import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { logAction } from "@/modules/audit/repository";
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
// Queries
// ---------------------------------------------------------------------------

export { listTripRequestsByRequester, listTripRequestsByCompany, findTripRequestById };
