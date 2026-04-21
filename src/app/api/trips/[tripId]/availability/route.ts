// =============================================================================
// GET /api/trips/[tripId]/availability
// =============================================================================
//
// Returns current seat availability for a trip, scoped to the caller's company.
// Used by NuevaReservaForm to render the SeatGrid before booking.
//
// Response:
//   200 {
//     data: {
//       tripId:    string;
//       capacity:  number;
//       confirmed: number;
//       pending:   number;
//       available: number;
//     }
//   }
//   401 UNAUTHORIZED
//   404 NOT_FOUND
//
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { auth }                      from "@/lib/auth";
import { prisma }                    from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> },
): Promise<NextResponse> {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "No autorizado." } },
      { status: 401 },
    );
  }

  const { tripId } = await params;

  const trip = await prisma.trip.findFirst({
    where:  { id: tripId, companyId: session.user.companyId },
    select: {
      id:       true,
      capacity: true,
      passengerSlots: {
        where:  { status: { in: ["PENDING", "CONFIRMED"] } },
        select: { id: true, status: true },
      },
    },
  });

  if (!trip) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Viaje no encontrado." } },
      { status: 404 },
    );
  }

  const confirmed = trip.passengerSlots.filter((s) => s.status === "CONFIRMED").length;
  const pending   = trip.passengerSlots.filter((s) => s.status === "PENDING").length;
  const available = Math.max(0, trip.capacity - confirmed - pending);

  return NextResponse.json({
    data: {
      tripId:    trip.id,
      capacity:  trip.capacity,
      confirmed,
      pending,
      available,
    },
  });
}
