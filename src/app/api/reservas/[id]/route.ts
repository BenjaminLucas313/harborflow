// =============================================================================
// DELETE /api/reservas/[id]
// =============================================================================
//
// Cancels a GroupBooking (reserva grupal) owned by the authenticated EMPRESA user.
//
// AUTH
// ----
// Requires an EMPRESA session with a valid employerId.
// companyId, actorId, and employerId are always derived from the session.
//
// BUSINESS RULES
// --------------
//   • Only the employer who created the booking (or shares the same employerId)
//     can cancel it.
//   • Bookings already CANCELLED cannot be cancelled again (idempotent 200).
//   • Cancellation is only allowed up to 2 hours before the trip departure.
//   • ALL slots are cancelled — including CONFIRMED (UABL-approved) slots.
//     This is a full retraction from UABL's manifest.
//
// RESPONSE
// --------
// 200 OK:  { data: GroupBooking }
// 401:     { error: { code: "UNAUTHORIZED", message } }
// 403:     { error: { code: "FORBIDDEN", message } }
// 404:     { error: { code: "GROUP_BOOKING_NOT_FOUND", message } }
// 422:     { error: { code: "CANCELLATION_TOO_LATE", message } }
// 500:     { error: { code: "INTERNAL_ERROR", message } }
//
// =============================================================================

import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { assertRole } from "@/lib/permissions";
import { cancelGroupBookingByOwner } from "@/modules/group-bookings/service";

type RouteParams = { params: Promise<{ id: string }> };

export async function DELETE(
  _req: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Autenticación requerida." } },
      { status: 401 },
    );
  }

  try {
    assertRole(session.user.role, ["EMPRESA"]);
  } catch {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Solo empleadores pueden cancelar reservas." } },
      { status: 403 },
    );
  }

  if (!session.user.employerId) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Tu cuenta no tiene un empleador asignado." } },
      { status: 403 },
    );
  }

  // ── Cancel ────────────────────────────────────────────────────────────────
  const { id } = await params;

  try {
    const data = await cancelGroupBookingByOwner(
      id,
      session.user.id,
      session.user.employerId,
      session.user.companyId,
    );
    return NextResponse.json({ data });
  } catch (err) {
    if (err instanceof AppError) {
      const status =
        err.statusCode === 404 ? 404
        : err.statusCode === 409 ? 409
        : err.statusCode === 422 ? 422
        : err.statusCode === 403 ? 403
        : 400;
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status },
      );
    }
    console.error("[DELETE /api/reservas/[id]]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Error interno del servidor." } },
      { status: 500 },
    );
  }
}
