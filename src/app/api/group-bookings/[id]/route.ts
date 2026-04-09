// PATCH /api/group-bookings/[id] — submit or cancel a GroupBooking (EMPRESA only)
// GET   /api/group-bookings/[id] — get booking detail

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { assertRole } from "@/lib/permissions";
import {
  submitGroupBooking,
  cancelGroupBooking,
} from "@/modules/group-bookings/service";
import { findGroupBookingById } from "@/modules/group-bookings/repository";
import { GroupBookingActionSchema } from "@/modules/group-bookings/schema";

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

    return NextResponse.json(booking);
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

export async function PATCH(
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
    const parsed = GroupBookingActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { code: "VALIDATION_ERROR", message: "Acción inválida." },
        { status: 400 },
      );
    }

    const { id } = await params;
    const ctx = {
      companyId:  session.user.companyId,
      employerId: session.user.employerId,
      bookedById: session.user.id,
    };

    const result =
      parsed.data.action === "SUBMIT"
        ? await submitGroupBooking(id, ctx)
        : await cancelGroupBooking(id, ctx);

    return NextResponse.json(result);
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
