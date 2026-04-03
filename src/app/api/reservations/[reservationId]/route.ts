// DELETE /api/reservations/[reservationId]
// Cancels a CONFIRMED reservation owned by the authenticated passenger.
// If the trip has a waitlist, the first WAITING user is automatically promoted.

import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { cancelReservation } from "@/modules/reservations/service";

type RouteParams = { params: Promise<{ reservationId: string }> };

export async function DELETE(
  _req: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  const session = await auth();

  if (!session) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Authentication required." },
      { status: 401 },
    );
  }

  if (session.user.role !== "PASSENGER") {
    return NextResponse.json(
      { code: "FORBIDDEN", message: "Only passengers can cancel their own reservations." },
      { status: 403 },
    );
  }

  const { reservationId } = await params;

  try {
    const result = await cancelReservation({
      reservationId,
      userId: session.user.id,
      companyId: session.user.companyId,
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { code: err.code, message: err.message },
        { status: err.statusCode },
      );
    }
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}
