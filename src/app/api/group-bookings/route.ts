// POST /api/group-bookings — create a GroupBooking in DRAFT status (EMPRESA only)
// GET  /api/group-bookings?tripId= — list bookings (EMPRESA: own, UABL: by trip)

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { parseZodError } from "@/lib/zod-errors";
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
    if (!session) {
      return NextResponse.json(
        { code: "UNAUTHORIZED", message: "Authentication required." },
        { status: 401 },
      );
    }

    assertRole(session.user.role, ["EMPRESA"]);

    if (!session.user.employerId) {
      return NextResponse.json(
        { code: "FORBIDDEN", message: "Tu cuenta no tiene empleador asignado." },
        { status: 403 },
      );
    }

    const body = await req.json();
    const parsed = CreateGroupBookingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { code: "VALIDATION_ERROR", message: "Datos inválidos.", fields: parseZodError(parsed.error) },
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
      return NextResponse.json(
        { code: err.code, message: err.message },
        { status: err.statusCode },
      );
    }
    console.error("[POST /api/group-bookings]", err);
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "Error interno." },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json(
        { code: "UNAUTHORIZED", message: "Authentication required." },
        { status: 401 },
      );
    }

    assertRole(session.user.role, ["EMPRESA", "UABL"]);

    const { searchParams } = new URL(req.url);
    const tripId = searchParams.get("tripId");
    const page   = Math.max(1, parseInt(searchParams.get("page")  ?? "1",  10) || 1);
    const limit  = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));

    if (session.user.role === "UABL") {
      if (!tripId) {
        return NextResponse.json(
          { code: "VALIDATION_ERROR", message: "Se requiere tripId." },
          { status: 400 },
        );
      }
      const { items, total } = await listGroupBookingsByTrip(session.user.companyId, tripId, { page, limit });
      return NextResponse.json({ data: items, total, page, totalPages: Math.ceil(total / limit) });
    }

    // EMPRESA: own employer's bookings
    if (!session.user.employerId) {
      return NextResponse.json({ data: [], total: 0, page: 1, totalPages: 0 }, { status: 200 });
    }
    const { items, total } = await listGroupBookingsByEmployer(
      session.user.companyId,
      session.user.employerId,
      { page, limit },
    );
    return NextResponse.json({ data: items, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { code: err.code, message: err.message },
        { status: err.statusCode },
      );
    }
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "Error interno." },
      { status: 500 },
    );
  }
}
