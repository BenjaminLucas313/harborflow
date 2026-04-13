// POST /api/reservations — book a trip (PASSENGER only)
//   Body: { tripId: string }
//   companyId and userId are always taken from the session — never the body.
//
// GET /api/reservations — list reservations (authenticated)
//   PASSENGER : own active reservations (no query params needed)
//   OPERATOR / ADMIN : ?tripId=<id>  — manifest for a specific trip

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { parseZodError } from "@/lib/zod-errors";
import {
  bookTrip,
  listReservationsByUser,
  listReservationsByTrip,
} from "@/modules/reservations/service";

// ---------------------------------------------------------------------------
// POST — create a reservation
// ---------------------------------------------------------------------------

const CreateReservationBodySchema = z.object({
  tripId: z.string().min(1),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth();

  if (!session) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Authentication required." },
      { status: 401 },
    );
  }

  if (session.user.role !== "PASSENGER") {
    return NextResponse.json(
      { code: "FORBIDDEN", message: "Only passengers can create reservations." },
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
      { code: "VALIDATION_ERROR", message: "Datos inválidos.", fields: parseZodError(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const result = await bookTrip({
      tripId: parsed.data.tripId,
      userId: session.user.id,
      companyId: session.user.companyId,
    });

    // Return the booking outcome with a discriminated type field so the client
    // can branch on "CONFIRMED" vs "WAITLISTED" without inspecting status strings.
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

// ---------------------------------------------------------------------------
// GET — list reservations
// ---------------------------------------------------------------------------

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
    if (role === "PASSENGER") {
      // Passengers see only their own active reservations.
      const reservations = await listReservationsByUser(userId, companyId);
      return NextResponse.json({ reservations });
    }

    // Operators and admins query by tripId.
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
