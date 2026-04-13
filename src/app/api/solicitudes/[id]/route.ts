// =============================================================================
// DELETE /api/solicitudes/[id]
// =============================================================================
//
// Cancels a TripRequest (solicitud) owned by the authenticated EMPRESA user.
//
// AUTH
// ----
// Requires an EMPRESA session. companyId and actorId are always derived from
// the session — never from the request body or URL.
//
// BUSINESS RULES
// --------------
//   • Only the user who created the solicitud can cancel it.
//   • Solicitudes already REJECTED or CANCELLED cannot be cancelled again.
//   • Cancellation is only allowed up to 2 hours before the trip departure.
//   • If the solicitud was FULFILLED (trip was created), all GroupBookings for
//     this company on that trip are also cancelled, including UABL-confirmed slots.
//
// RESPONSE
// --------
// 200 OK:  { data: TripRequestWithRelations }
// 401:     { error: { code: "UNAUTHORIZED", message } }
// 403:     { error: { code: "FORBIDDEN", message } }
// 404:     { error: { code: "TRIP_REQUEST_NOT_FOUND", message } }
// 409:     { error: { code: "TRIP_REQUEST_NOT_CANCELLABLE", message } }
// 422:     { error: { code: "CANCELLATION_TOO_LATE", message } }
// 500:     { error: { code: "INTERNAL_ERROR", message } }
//
// =============================================================================

import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { assertRole } from "@/lib/permissions";
import { cancelTripRequestByOwner } from "@/modules/trip-requests/service";

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
      { error: { code: "FORBIDDEN", message: "Solo empleadores pueden cancelar solicitudes." } },
      { status: 403 },
    );
  }

  // ── Cancel ────────────────────────────────────────────────────────────────
  const { id } = await params;

  try {
    const data = await cancelTripRequestByOwner(
      id,
      session.user.id,
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
    console.error("[DELETE /api/solicitudes/[id]]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Error interno del servidor." } },
      { status: 500 },
    );
  }
}
