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
  },
): Promise<PassengerSlot> {
  const slot = await findSlotById(slotId);

  if (!slot || slot.companyId !== ctx.companyId) {
    throw new AppError("SLOT_NOT_FOUND", "Slot no encontrado.", 404);
  }

  // UABL dept authorization — only reviews slots assigned to their department.
  assertDepartment(ctx.departmentId, slot.departmentId);

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
