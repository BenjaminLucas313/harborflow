// POST /api/trip-requests — EMPRESA submits an on-demand boat request
// GET  /api/trip-requests — list requests
//   EMPRESA: own requests (filtered by requestedById)
//   PROVEEDOR: all requests for their company (optional ?status= filter)

import { NextRequest, NextResponse } from "next/server";
import { TripRequestStatus } from "@prisma/client";

import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { parseZodError } from "@/lib/zod-errors";
import { assertRole } from "@/lib/permissions";
import { createTripRequest, listTripRequestsByRequester, listTripRequestsByCompany } from "@/modules/trip-requests/service";
import { CreateTripRequestSchema } from "@/modules/trip-requests/schema";

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

    if (!session.user.companyId) {
      return NextResponse.json(
        { code: "VALIDATION_ERROR", message: "Tu cuenta no tiene una empresa asociada. Cerrá sesión y volvé a ingresar." },
        { status: 400 },
      );
    }

    const body = await req.json();
    const parsed = CreateTripRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { code: "VALIDATION_ERROR", message: "Datos inválidos.", fields: parseZodError(parsed.error) },
        { status: 400 },
      );
    }

    const request = await createTripRequest(parsed.data, {
      companyId:     session.user.companyId,
      requestedById: session.user.id,
    });

    return NextResponse.json(request, { status: 201 });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { code: err.code, message: err.message },
        { status: err.statusCode },
      );
    }
    console.error("[POST /api/trip-requests]", err);
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

    assertRole(session.user.role, ["EMPRESA", "PROVEEDOR"]);

    const { searchParams } = new URL(req.url);

    if (session.user.role === "EMPRESA") {
      const requests = await listTripRequestsByRequester(
        session.user.companyId,
        session.user.id,
      );
      return NextResponse.json(requests);
    }

    // PROVEEDOR: all for their company, optional status filter.
    const statusParam = searchParams.get("status");
    let status: TripRequestStatus | undefined;
    if (statusParam) {
      if (!(statusParam in TripRequestStatus)) {
        return NextResponse.json(
          { code: "VALIDATION_ERROR", message: `Estado inválido: ${statusParam}` },
          { status: 400 },
        );
      }
      status = statusParam as TripRequestStatus;
    }

    const requests = await listTripRequestsByCompany(session.user.companyId, status);
    return NextResponse.json(requests);
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
