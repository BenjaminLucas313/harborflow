// POST /api/reservations — legacy V1 booking endpoint.
//
// NOTE: This endpoint is retained for historical data compatibility.
// New bookings in V2 use the allocation flow:
//   POST /api/allocations → POST /api/allocations/[id]/seats → POST /api/allocations/[id]/submit
//
// GET /api/reservations — legacy V1 reservation listing.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import {
  bookTrip,
  listReservationsByUser,
  listReservationsByTrip,
} from "@/modules/reservations/service";

const CreateReservationBodySchema = z.object({
  tripId: z.string().min(1),
});

/** @deprecated V1 only. New bookings use /api/allocations. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth();

  if (!session) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Authentication required." },
      { status: 401 },
    );
  }

  // In V2, EMPLOYEE is the equivalent of the old PASSENGER role.
  if (session.user.role !== "EMPLOYEE") {
    return NextResponse.json(
      { code: "FORBIDDEN", message: "Only employees can create legacy reservations." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const parsed = CreateReservationBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "tripId is required." },
      { status: 400 },
    );
  }

  try {
    const result = await bookTrip({
      tripId: parsed.data.tripId,
      userId: session.user.id,
      companyId: session.user.companyId,
    });

    return NextResponse.json(result, { status: 201 });
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

/** @deprecated V1 only. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await auth();

  if (!session) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Authentication required." },
      { status: 401 },
    );
  }

  const { role, id: userId, companyId } = session.user;

  try {
    if (role === "EMPLOYEE") {
      const reservations = await listReservationsByUser(userId, companyId);
      return NextResponse.json({ reservations });
    }

    const tripId = req.nextUrl.searchParams.get("tripId");
    if (!tripId) {
      return NextResponse.json(
        { code: "VALIDATION_ERROR", message: "tripId query parameter is required." },
        { status: 400 },
      );
    }

    const reservations = await listReservationsByTrip(tripId, companyId);
    return NextResponse.json({ reservations });
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
