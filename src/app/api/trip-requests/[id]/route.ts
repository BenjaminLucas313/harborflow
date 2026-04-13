// PATCH /api/trip-requests/[id] — PROVEEDOR accepts or rejects a TripRequest
// GET   /api/trip-requests/[id] — get request detail (EMPRESA or PROVEEDOR)

import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { parseZodError } from "@/lib/zod-errors";
import { assertRole } from "@/lib/permissions";
import { reviewTripRequest, findTripRequestById } from "@/modules/trip-requests/service";
import { ReviewTripRequestSchema } from "@/modules/trip-requests/schema";

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

    assertRole(session.user.role, ["EMPRESA", "PROVEEDOR"]);

    const { id } = await params;
    const request = await findTripRequestById(id, session.user.companyId);
    if (!request) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Solicitud no encontrada." },
        { status: 404 },
      );
    }

    return NextResponse.json(request);
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

    assertRole(session.user.role, ["PROVEEDOR"]);

    const body = await req.json();
    const parsed = ReviewTripRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { code: "VALIDATION_ERROR", message: "Datos inválidos.", fields: parseZodError(parsed.error) },
        { status: 400 },
      );
    }

    const { id } = await params;
    const request = await reviewTripRequest(id, parsed.data, {
      companyId:    session.user.companyId,
      reviewedById: session.user.id,
    });

    return NextResponse.json(request);
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { code: err.code, message: err.message },
        { status: err.statusCode },
      );
    }
    console.error("[PATCH /api/trip-requests/[id]]", err);
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "Error interno." },
      { status: 500 },
    );
  }
}
