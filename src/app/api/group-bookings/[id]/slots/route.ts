// POST /api/group-bookings/[id]/slots — add a passenger slot (EMPRESA only)
// GET  /api/group-bookings/[id]/slots — list slots for this booking

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { assertRole } from "@/lib/permissions";
import { addSlotToBooking } from "@/modules/group-bookings/service";
import { listSlotsByTrip } from "@/modules/passenger-slots/service";
import { findGroupBookingById } from "@/modules/group-bookings/repository";
import { AddSlotSchema } from "@/modules/group-bookings/schema";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
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
        { code: "FORBIDDEN", message: "Sin empleador asignado." },
        { status: 403 },
      );
    }

    const body = await req.json();
    const parsed = AddSlotSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { code: "VALIDATION_ERROR", message: "Datos inválidos." },
        { status: 400 },
      );
    }

    const { id } = await params;
    const slot = await addSlotToBooking(id, parsed.data, {
      companyId:  session.user.companyId,
      employerId: session.user.employerId,
      bookedById: session.user.id,
    });

    return NextResponse.json(slot, { status: 201 });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { code: err.code, message: err.message },
        { status: err.statusCode },
      );
    }
    console.error("[POST /api/group-bookings/[id]/slots]", err);
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "Error interno." },
      { status: 500 },
    );
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json(
        { code: "UNAUTHORIZED", message: "Authentication required." },
        { status: 401 },
      );
    }

    assertRole(session.user.role, ["EMPRESA", "UABL"]);

    const { id } = await params;
    const booking = await findGroupBookingById(id);
    if (!booking || booking.companyId !== session.user.companyId) {
      return NextResponse.json(
        { code: "GROUP_BOOKING_NOT_FOUND", message: "Reserva no encontrada." },
        { status: 404 },
      );
    }

    const slots = await listSlotsByTrip(session.user.companyId, booking.tripId);
    const filtered = slots.filter((s) => s.groupBookingId === id);

    return NextResponse.json(filtered);
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
