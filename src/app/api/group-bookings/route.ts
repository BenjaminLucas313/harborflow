// POST /api/group-bookings — create a GroupBooking in DRAFT status (EMPRESA only)
// GET  /api/group-bookings?tripId= — list bookings (EMPRESA: own, UABL: by trip)

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { assertRole } from "@/lib/permissions";
import {
  createGroupBooking,
  listGroupBookingsByEmployer,
  listGroupBookingsByTrip,
} from "@/modules/group-bookings/service";
import { CreateGroupBookingSchema } from "@/modules/group-bookings/schema";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    assertRole(session.user.role, ["EMPRESA"]);

    if (!session.user.employerId) {
      return NextResponse.json(
        { error: "Tu cuenta no tiene empleador asignado." },
        { status: 403 },
      );
    }

    const body = await req.json();
    const parsed = CreateGroupBookingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const booking = await createGroupBooking(parsed.data, {
      companyId:  session.user.companyId,
      employerId: session.user.employerId,
      bookedById: session.user.id,
    });

    return NextResponse.json(booking, { status: 201 });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    console.error("[POST /api/group-bookings]", err);
    return NextResponse.json({ error: "Error interno." }, { status: 500 });
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    assertRole(session.user.role, ["EMPRESA", "UABL"]);

    const { searchParams } = new URL(req.url);
    const tripId = searchParams.get("tripId");

    if (session.user.role === "UABL") {
      if (!tripId) {
        return NextResponse.json({ error: "Se requiere tripId." }, { status: 400 });
      }
      const bookings = await listGroupBookingsByTrip(session.user.companyId, tripId);
      return NextResponse.json(bookings);
    }

    // EMPRESA: own employer's bookings
    if (!session.user.employerId) {
      return NextResponse.json([], { status: 200 });
    }
    const bookings = await listGroupBookingsByEmployer(
      session.user.companyId,
      session.user.employerId,
    );
    return NextResponse.json(bookings);
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: "Error interno." }, { status: 500 });
  }
}
