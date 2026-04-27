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
//      cancelGroupBookingByOwner also enforces the 2h self-cancel window and
//      cancels CONFIRMED slots (full UABL retraction).

import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { logAction } from "@/modules/audit/repository";
import { notifySlotAssigned } from "@/lib/notifications";
import {
  checkSelfCancellation,
  CANCELLATION_MESSAGES,
} from "@/lib/cancellation-policy";
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
    select: {
      id:            true,
      companyId:     true,
      branchId:      true,
      status:        true,
      capacity:      true,
      departureTime: true,
      passengerSlots: input.slotsRequested
        ? { where: { status: { in: ["PENDING", "CONFIRMED"] } }, select: { id: true } }
        : undefined,
    },
  });

  if (!trip || trip.companyId !== ctx.companyId) {
    throw new AppError("TRIP_NOT_FOUND", "Viaje no encontrado.", 404);
  }

  if (trip.departureTime <= new Date()) {
    throw new AppError("TRIP_DEPARTURE_PAST", "Este viaje ya partió y no acepta nuevas reservas.", 400);
  }

  const bookableStatuses = ["SCHEDULED", "BOARDING", "DELAYED"] as const;
  if (!bookableStatuses.includes(trip.status as typeof bookableStatuses[number])) {
    throw new AppError("TRIP_NOT_BOOKABLE", "El viaje no está disponible para reservas.", 409);
  }

  // Optional capacity pre-check (best-effort, non-transactional).
  // The definitive capacity guard is in addSlotToBooking (FOR UPDATE lock).
  if (input.slotsRequested && trip.passengerSlots) {
    const occupied  = trip.passengerSlots.length;
    const available = trip.capacity - occupied;
    if (input.slotsRequested > available) {
      throw new AppError(
        "TRIP_CAPACITY_INSUFFICIENT",
        `Solo quedan ${available} asientos disponibles para este viaje.`,
        409,
      );
    }
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
        select: { capacity: true, departureTime: true },
      });
      if (!trip) throw new AppError("TRIP_NOT_FOUND", "Viaje no encontrado.", 404);

      if (trip.departureTime <= new Date()) {
        throw new AppError("TRIP_DEPARTURE_PAST", "Este viaje ya partió. No se pueden agregar pasajeros.", 400);
      }

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

  const tripCheck = await prisma.trip.findUnique({
    where:  { id: booking.tripId },
    select: { departureTime: true },
  });
  if (tripCheck && tripCheck.departureTime <= new Date()) {
    throw new AppError("TRIP_DEPARTURE_PAST", "Este viaje ya partió. No se puede enviar la reserva.", 400);
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
// Cancel by owner — enforces cancellation policy + full slot retraction
// ---------------------------------------------------------------------------

/**
 * Cancels a GroupBooking on behalf of the EMPRESA user who created it.
 *
 * This is the *self-service* cancel path, distinct from the existing
 * `cancelGroupBooking` which is used by the PATCH action flow and only
 * cancels PENDING slots.
 *
 * Steps:
 *   1. Fetch the booking — must exist and belong to the caller's company.
 *   2. Verify ownership: bookedById === actorId OR employerId === employerId.
 *   3. Guard idempotency: already CANCELLED → return as-is.
 *   4. Fetch the linked trip to determine departure time.
 *   5. Check self-cancellation policy (2h window).
 *   6. Transaction:
 *        a. Cancel ALL slots (PENDING + CONFIRMED) — full UABL retraction.
 *        b. Mark GroupBooking as CANCELLED.
 *   7. Audit log.
 *
 * Throws:
 *   GROUP_BOOKING_NOT_FOUND (404)         — booking missing or wrong company/owner
 *   GROUP_BOOKING_NOT_CANCELLABLE (409)   — already CANCELLED (idempotency guard)
 *   CANCELLATION_TOO_LATE (422)           — within 2h or past departure
 */
export async function cancelGroupBookingByOwner(
  bookingId:  string,
  actorId:    string,
  employerId: string,
  companyId:  string,
): Promise<GroupBooking> {
  // 1. Fetch with company scope.
  const booking = await findGroupBookingById(bookingId);

  if (!booking || booking.companyId !== companyId) {
    throw new AppError("GROUP_BOOKING_NOT_FOUND", "Reserva no encontrada.", 404);
  }

  // 2. Ownership: the booking must belong to the caller's employer.
  if (booking.bookedById !== actorId && booking.employerId !== employerId) {
    throw new AppError("GROUP_BOOKING_NOT_FOUND", "Reserva no encontrada.", 404);
  }

  // 3. Already cancelled — idempotent return.
  if (booking.status === "CANCELLED") {
    return booking;
  }

  // 4. Fetch departure time from the linked trip.
  const trip = await prisma.trip.findUnique({
    where:  { id: booking.tripId },
    select: { departureTime: true },
  });

  if (!trip) {
    throw new AppError("TRIP_NOT_FOUND", "Viaje asociado no encontrado.", 404);
  }

  // 5. Cancellation policy check.
  const check = checkSelfCancellation(trip.departureTime);
  if (!check.allowed) {
    throw new AppError(
      "CANCELLATION_TOO_LATE",
      CANCELLATION_MESSAGES[check.reason],
      422,
    );
  }

  // 6. Atomic cancellation — cancel ALL slots including UABL-confirmed ones.
  await prisma.$transaction([
    prisma.passengerSlot.updateMany({
      where: {
        groupBookingId: bookingId,
        status:         { in: ["PENDING", "CONFIRMED"] },
      },
      data: { status: "CANCELLED" },
    }),
    prisma.groupBooking.update({
      where: { id: bookingId },
      data:  { status: "CANCELLED" },
    }),
  ]);

  // 7. Audit — best-effort.
  logAction({
    companyId,
    actorId,
    action:     "GROUP_BOOKING_CANCELLED",
    entityType: "GroupBooking",
    entityId:   bookingId,
    payload:    { tripId: booking.tripId, employerId },
  }).catch(() => {});

  return (await findGroupBookingById(bookingId))!;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export { listGroupBookingsByEmployer, listGroupBookingsByTrip };
