// Passenger slot service — UABL review flow (confirm / reject).
//
// Authorization:
//   A UABL user can only review slots whose departmentId matches their own.
//   This is enforced in assertDepartment() before any DB write.
//
// After each review, GroupBooking.status is recomputed:
//   All CONFIRMED → CONFIRMED
//   Any PENDING   → PARTIAL
//   All REJECTED/CANCELLED → CANCELLED

import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { assertDepartment } from "@/lib/permissions";
import { logAction } from "@/modules/audit/repository";
import { recomputeGroupBookingStatus } from "@/modules/group-bookings/repository";
import { notifySlotReviewed } from "@/lib/notifications";
import { formatArgDate } from "@/lib/date-utils";
import { crearNotificacion } from "@/modules/notificaciones/service";
import { findSlotById, listSlotsByTrip, listSlotsByDepartment, listSlotsByUsuario } from "./repository";
import type { SlotWithRelations } from "./repository";
import type { PassengerSlot } from "@prisma/client";
import type { ReviewSlotInput } from "./schema";

/**
 * Reviews (confirms or rejects) a PassengerSlot.
 *
 * Throws:
 *   SLOT_NOT_FOUND (404)          — slot doesn't exist or wrong company
 *   UNAUTHORIZED_DEPARTMENT (403) — caller's dept ≠ slot's dept
 *   SLOT_NOT_PENDING (409)        — slot was already reviewed
 */
export async function reviewSlot(
  slotId: string,
  input: ReviewSlotInput,
  ctx: {
    companyId:    string;
    reviewedById: string;
    departmentId: string | null;
    isUablAdmin?: boolean;
  },
): Promise<PassengerSlot> {
  const slot = await findSlotById(slotId);

  if (!slot || slot.companyId !== ctx.companyId) {
    throw new AppError("SLOT_NOT_FOUND", "Slot no encontrado.", 404);
  }

  // UABL admins can review slots across all departments; regular UABL users
  // are restricted to their own department.
  if (!ctx.isUablAdmin) {
    assertDepartment(ctx.departmentId, slot.departmentId);
  }

  if (slot.status !== "PENDING") {
    throw new AppError(
      "SLOT_NOT_PENDING",
      "Este slot ya fue revisado.",
      409,
    );
  }

  const newStatus = input.action === "CONFIRM" ? "CONFIRMED" : "REJECTED";

  const updated = await prisma.passengerSlot.update({
    where: { id: slotId },
    data: {
      status:        newStatus,
      reviewedById:  ctx.reviewedById,
      reviewedAt:    new Date(),
      rejectionNote: input.rejectionNote ?? null,
    },
  });

  // Recompute parent GroupBooking status.
  await recomputeGroupBookingStatus(slot.groupBookingId);

  // ── Post-write (best-effort) ───────────────────────────────────────────────

  const reviewedAsAdmin =
    ctx.isUablAdmin === true && ctx.departmentId !== slot.departmentId;

  logAction({
    companyId:  ctx.companyId,
    actorId:    ctx.reviewedById,
    action:     newStatus === "CONFIRMED" ? "SLOT_CONFIRMED" : "SLOT_REJECTED",
    entityType: "PassengerSlot",
    entityId:   slotId,
    payload:    {
      tripId:        slot.tripId,
      usuarioId:     slot.usuarioId,
      departmentId:  slot.departmentId,
      rejectionNote: input.rejectionNote,
      ...(reviewedAsAdmin ? { reviewedAsAdmin: true } : {}),
    },
  }).catch(() => {});

  // Notify both USUARIO and the EMPRESA user who created the booking.
  notifySlotReviewed({
    slotId,
    usuarioEmail: slot.usuario.email,
    usuarioName:  `${slot.usuario.firstName} ${slot.usuario.lastName}`,
    tripId:       slot.tripId,
    workTypeName: slot.workType.name,
    status:       newStatus,
    rejectionNote: input.rejectionNote,
    groupBookingId: slot.groupBookingId,
  }).catch(() => {});

  // Best-effort in-app notifications for USUARIO and EMPRESA.
  Promise.all([
    prisma.trip.findUnique({
      where:  { id: slot.tripId },
      select: { departureTime: true },
    }),
    prisma.groupBooking.findUnique({
      where:  { id: slot.groupBookingId },
      select: { status: true, bookedById: true },
    }),
  ]).then(([trip, booking]) => {
    const fechaStr = trip ? formatArgDate(trip.departureTime) : "el viaje";

    crearNotificacion({
      userId:    slot.usuarioId,
      companyId: ctx.companyId,
      tipo:      newStatus === "CONFIRMED" ? "SLOT_CONFIRMADO" : "SLOT_RECHAZADO",
      titulo:    newStatus === "CONFIRMED" ? "Pasaje confirmado" : "Pasaje rechazado",
      mensaje:   newStatus === "CONFIRMED"
        ? `Tu lugar en el viaje del ${fechaStr} fue confirmado`
        : `Tu solicitud para el viaje del ${fechaStr} no fue aprobada`,
      accionUrl: "/usuario/viajes",
    }).catch(() => {});

    if (newStatus === "CONFIRMED" && booking?.status === "CONFIRMED") {
      crearNotificacion({
        userId:    booking.bookedById,
        companyId: ctx.companyId,
        tipo:      "GROUP_BOOKING_CONFIRMADO",
        titulo:    "Reserva grupal confirmada",
        mensaje:   `Tu reserva grupal para el ${fechaStr} fue confirmada`,
        accionUrl: "/empresa/reservas",
      }).catch(() => {});
    }
  }).catch(() => {});

  return updated;
}

/**
 * Reverts a CONFIRMED PassengerSlot to CANCELLED, freeing the seat.
 *
 * Authorization: the UABL user who originally confirmed the slot,
 * OR any UABL user with isUablAdmin = true within the same company.
 *
 * Throws:
 *   SLOT_NOT_FOUND (404)       — slot doesn't exist or wrong company
 *   SLOT_NOT_CONFIRMED (409)   — slot is not in CONFIRMED status
 *   FORBIDDEN (403)            — caller is neither the reviewer nor UABL admin
 */
export async function revertSlot(
  slotId: string,
  ctx: {
    companyId:   string;
    actorId:     string;
    isUablAdmin: boolean;
  },
): Promise<PassengerSlot> {
  const slot = await findSlotById(slotId);

  if (!slot || slot.companyId !== ctx.companyId) {
    throw new AppError("SLOT_NOT_FOUND", "Slot no encontrado.", 404);
  }

  if (slot.status !== "CONFIRMED") {
    throw new AppError(
      "SLOT_NOT_CONFIRMED",
      "Solo se pueden revertir slots confirmados.",
      409,
    );
  }

  const isReviewer = slot.reviewedById === ctx.actorId;
  if (!isReviewer && !ctx.isUablAdmin) {
    throw new AppError(
      "FORBIDDEN",
      "No tenés permiso para revertir esta confirmación.",
      403,
    );
  }

  const updated = await prisma.passengerSlot.update({
    where: { id: slotId },
    data: {
      status:       "CANCELLED",
      reviewedById: null,
      reviewedAt:   null,
      rejectionNote: null,
    },
  });

  // Recompute parent GroupBooking status.
  await recomputeGroupBookingStatus(slot.groupBookingId);

  logAction({
    companyId:  ctx.companyId,
    actorId:    ctx.actorId,
    action:     "SLOT_REVERTED",
    entityType: "PassengerSlot",
    entityId:   slotId,
    payload:    {
      tripId:       slot.tripId,
      usuarioId:    slot.usuarioId,
      departmentId: slot.departmentId,
    },
  }).catch(() => {});

  return updated;
}

// ---------------------------------------------------------------------------
// Queries (exposed for route handlers)
// ---------------------------------------------------------------------------

export { listSlotsByTrip, listSlotsByDepartment, listSlotsByUsuario };

export async function getSlotById(
  id: string,
  companyId: string,
): Promise<SlotWithRelations> {
  const slot = await findSlotById(id);
  if (!slot || slot.companyId !== companyId) {
    throw new AppError("SLOT_NOT_FOUND", "Slot no encontrado.", 404);
  }
  return slot;
}
