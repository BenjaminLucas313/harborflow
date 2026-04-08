// Group booking service — the core booking flow for EMPRESA role.
//
// Booking flow:
//   1. EMPRESA creates a GroupBooking in DRAFT status (no slots yet).
//   2. EMPRESA adds PassengerSlots (one per seat) via addSlotToBooking.
//      Each slot links a USUARIO account to a WorkType.
//      Capacity is checked inside a transaction with a Trip row lock.
//   3. EMPRESA submits the GroupBooking → status SUBMITTED.
//      From this point, UABL can review each slot.
//   4. EMPRESA can cancel the booking → status CANCELLED,
//      all non-confirmed slots → CANCELLED.

import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { logAction } from "@/modules/audit/repository";
import { notifySlotAssigned } from "@/lib/notifications";
import {
  findGroupBookingById,
  createGroupBooking as repoCreate,
  updateGroupBookingStatus,
  listGroupBookingsByEmployer,
  listGroupBookingsByTrip,
} from "./repository";
import type { GroupBooking, PassengerSlot } from "@prisma/client";
import type {
  CreateGroupBookingInput,
  AddSlotInput,
} from "./schema";

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * Creates a new GroupBooking in DRAFT status for an EMPRESA user.
 *
 * The trip must exist and belong to the same company/branch.
 * No capacity check at creation time — slots are added separately.
 */
export async function createGroupBooking(
  input: CreateGroupBookingInput,
  ctx: {
    companyId:  string;
    employerId: string;
    bookedById: string;
  },
): Promise<GroupBooking> {
  const trip = await prisma.trip.findUnique({
    where:  { id: input.tripId },
    select: { id: true, companyId: true, branchId: true, status: true },
  });

  if (!trip || trip.companyId !== ctx.companyId) {
    throw new AppError("TRIP_NOT_FOUND", "Viaje no encontrado.", 404);
  }

  const bookableStatuses = ["SCHEDULED", "BOARDING", "DELAYED"] as const;
  if (!bookableStatuses.includes(trip.status as typeof bookableStatuses[number])) {
    throw new AppError("TRIP_NOT_BOOKABLE", "El viaje no está disponible para reservas.", 409);
  }

  const booking = await repoCreate({
    companyId:  ctx.companyId,
    branchId:   trip.branchId,
    tripId:     input.tripId,
    employerId: ctx.employerId,
    bookedById: ctx.bookedById,
    notes:      input.notes,
  });

  logAction({
    companyId:  ctx.companyId,
    actorId:    ctx.bookedById,
    action:     "GROUP_BOOKING_CREATED",
    entityType: "GroupBooking",
    entityId:   booking.id,
    payload:    { tripId: input.tripId, employerId: ctx.employerId },
  }).catch(() => {});

  return booking;
}

// ---------------------------------------------------------------------------
// Add slot (with concurrency-safe capacity check)
// ---------------------------------------------------------------------------

/**
 * Adds a PassengerSlot to a GroupBooking.
 *
 * Capacity check is performed inside a transaction with a Trip row lock
 * (SELECT ... FOR UPDATE) to prevent the last-seat race condition.
 *
 * Throws:
 *   GROUP_BOOKING_NOT_FOUND (404) — booking doesn't exist or wrong company
 *   GROUP_BOOKING_NOT_DRAFT (409) — booking has already been submitted
 *   GROUP_BOOKING_FORBIDDEN (403) — caller's employer doesn't own this booking
 *   USUARIO_NOT_FOUND (404)       — referenced USUARIO doesn't exist
 *   WORKTYPE_NOT_FOUND (404)      — workType doesn't exist
 *   TRIP_AT_CAPACITY (409)        — no seats remaining (PENDING + CONFIRMED)
 *   SLOT_ALREADY_ASSIGNED (409)   — this USUARIO is already on this trip
 */
export async function addSlotToBooking(
  bookingId: string,
  input: AddSlotInput,
  ctx: {
    companyId:  string;
    employerId: string;
    bookedById: string;
  },
): Promise<PassengerSlot> {
  // ── Pre-checks (outside transaction) ──────────────────────────────────────

  const booking = await findGroupBookingById(bookingId);

  if (!booking || booking.companyId !== ctx.companyId) {
    throw new AppError("GROUP_BOOKING_NOT_FOUND", "Reserva grupal no encontrada.", 404);
  }
  if (booking.employerId !== ctx.employerId) {
    throw new AppError("GROUP_BOOKING_FORBIDDEN", "Sin acceso a esta reserva.", 403);
  }
  if (booking.status !== "DRAFT") {
    throw new AppError(
      "GROUP_BOOKING_NOT_DRAFT",
      "No se pueden agregar pasajeros a una reserva ya enviada.",
      409,
    );
  }

  // Verify USUARIO exists and belongs to same company.
  const usuario = await prisma.user.findUnique({
    where:  { id: input.usuarioId },
    select: { id: true, companyId: true, role: true, isActive: true, email: true, firstName: true, lastName: true },
  });
  if (!usuario || usuario.companyId !== ctx.companyId || usuario.role !== "USUARIO" || !usuario.isActive) {
    throw new AppError("USUARIO_NOT_FOUND", "Usuario no encontrado o no válido.", 404);
  }

  // Verify WorkType exists and belongs to same company.
  const workType = await prisma.workType.findUnique({
    where:  { id: input.workTypeId },
    select: { id: true, companyId: true, departmentId: true, name: true, isActive: true },
  });
  if (!workType || workType.companyId !== ctx.companyId || !workType.isActive) {
    throw new AppError("WORKTYPE_NOT_FOUND", "Tipo de trabajo no encontrado.", 404);
  }

  // ── Transactional capacity check + insert ─────────────────────────────────

  let newSlot: PassengerSlot;

  try {
    newSlot = await prisma.$transaction(async (tx) => {
      // Lock the Trip row to serialize concurrent slot additions.
      await tx.$queryRaw`SELECT id FROM "Trip" WHERE id = ${booking.tripId} FOR UPDATE`;

      // Count seats already consumed (PENDING holds capacity).
      const trip = await tx.trip.findUnique({
        where:  { id: booking.tripId },
        select: { capacity: true },
      });
      if (!trip) throw new AppError("TRIP_NOT_FOUND", "Viaje no encontrado.", 404);

      const occupied = await tx.passengerSlot.count({
        where: {
          tripId: booking.tripId,
          status: { in: ["PENDING", "CONFIRMED"] },
        },
      });

      if (occupied >= trip.capacity) {
        throw new AppError(
          "TRIP_AT_CAPACITY",
          "El viaje no tiene lugares disponibles.",
          409,
        );
      }

      return tx.passengerSlot.create({
        data: {
          companyId:         ctx.companyId,
          groupBookingId:    bookingId,
          tripId:            booking.tripId,
          branchId:          booking.branchId,
          usuarioId:         input.usuarioId,
          workTypeId:        input.workTypeId,
          departmentId:      workType.departmentId,
          representedCompany: input.representedCompany,
        },
      });
    });
  } catch (err: unknown) {
    // Prisma unique constraint violation → USUARIO already on this trip.
    if (
      err instanceof Error &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      throw new AppError(
        "SLOT_ALREADY_ASSIGNED",
        "Este usuario ya está asignado a este viaje.",
        409,
      );
    }
    throw err;
  }

  // ── Post-transaction (best-effort, never blocks the response) ─────────────

  logAction({
    companyId:  ctx.companyId,
    actorId:    ctx.bookedById,
    action:     "GROUP_BOOKING_SLOT_ADDED",
    entityType: "PassengerSlot",
    entityId:   newSlot.id,
    payload:    {
      bookingId,
      tripId:     booking.tripId,
      usuarioId:  input.usuarioId,
      workTypeId: input.workTypeId,
    },
  }).catch(() => {});

  // Notify the assigned USUARIO by email.
  notifySlotAssigned({
    toEmail:      usuario.email,
    toName:       `${usuario.firstName} ${usuario.lastName}`,
    slotId:       newSlot.id,
    tripId:       booking.tripId,
    workTypeName: workType.name,
  }).catch(() => {});

  return newSlot;
}

// ---------------------------------------------------------------------------
// Submit / Cancel
// ---------------------------------------------------------------------------

/**
 * Submits a GroupBooking for UABL review.
 * Transition: DRAFT → SUBMITTED.
 * After submission, no more slots can be added.
 */
export async function submitGroupBooking(
  bookingId: string,
  ctx: { companyId: string; employerId: string; bookedById: string },
): Promise<GroupBooking> {
  const booking = await findGroupBookingById(bookingId);

  if (!booking || booking.companyId !== ctx.companyId) {
    throw new AppError("GROUP_BOOKING_NOT_FOUND", "Reserva grupal no encontrada.", 404);
  }
  if (booking.employerId !== ctx.employerId) {
    throw new AppError("GROUP_BOOKING_FORBIDDEN", "Sin acceso a esta reserva.", 403);
  }
  if (booking.status !== "DRAFT") {
    throw new AppError(
      "GROUP_BOOKING_NOT_DRAFT",
      "La reserva ya fue enviada o cancelada.",
      409,
    );
  }
  if (booking.passengerSlots.length === 0) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Debe agregar al menos un pasajero antes de enviar.",
      400,
    );
  }

  const updated = await updateGroupBookingStatus(bookingId, "SUBMITTED");

  logAction({
    companyId:  ctx.companyId,
    actorId:    ctx.bookedById,
    action:     "GROUP_BOOKING_SUBMITTED",
    entityType: "GroupBooking",
    entityId:   bookingId,
    payload:    { slotCount: booking.passengerSlots.length },
  }).catch(() => {});

  return updated;
}

/**
 * Cancels a GroupBooking. All PENDING slots are also cancelled.
 * CONFIRMED slots are NOT cancelled — their seats are released only if
 * EMPRESA explicitly negotiates with UABL outside the system.
 */
export async function cancelGroupBooking(
  bookingId: string,
  ctx: { companyId: string; employerId: string; bookedById: string },
): Promise<GroupBooking> {
  const booking = await findGroupBookingById(bookingId);

  if (!booking || booking.companyId !== ctx.companyId) {
    throw new AppError("GROUP_BOOKING_NOT_FOUND", "Reserva grupal no encontrada.", 404);
  }
  if (booking.employerId !== ctx.employerId) {
    throw new AppError("GROUP_BOOKING_FORBIDDEN", "Sin acceso a esta reserva.", 403);
  }
  if (booking.status === "CANCELLED") {
    return booking; // Idempotent.
  }

  await prisma.$transaction([
    prisma.passengerSlot.updateMany({
      where: { groupBookingId: bookingId, status: "PENDING" },
      data:  { status: "CANCELLED" },
    }),
    prisma.groupBooking.update({
      where: { id: bookingId },
      data:  { status: "CANCELLED" },
    }),
  ]);

  logAction({
    companyId:  ctx.companyId,
    actorId:    ctx.bookedById,
    action:     "GROUP_BOOKING_CANCELLED",
    entityType: "GroupBooking",
    entityId:   bookingId,
    payload:    {},
  }).catch(() => {});

  return (await findGroupBookingById(bookingId))!;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export { listGroupBookingsByEmployer, listGroupBookingsByTrip };
