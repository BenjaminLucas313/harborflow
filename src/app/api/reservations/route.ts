// POST /api/reservations — create a reservation or trigger the replacement flow.
// All capacity logic and single-active-reservation enforcement live in modules/reservations/service.ts.
import { NextRequest, NextResponse } from "next/server";

export async function POST(_req: NextRequest): Promise<NextResponse> {
  // TODO: assert authenticated session, validate body with CreateReservationSchema,
  // call reservations service, return structured response.
  return NextResponse.json({ message: "not implemented" }, { status: 501 });
}
