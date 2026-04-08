// GET  /api/trips — list trips for a branch (public, no auth required)
//   Query params:
//     branchId  string   required
//     date      string   optional  YYYY-MM-DD — filters to that calendar day (UTC)
//     status    string   optional  TripStatus enum value — overrides the default non-terminal filter
//
// POST /api/trips — create a trip (PROVIDER only)
//   Body: CreateTripSchema fields (companyId is ignored from body — taken from session)
//
// Business logic lives in modules/trips/service.ts.

import { NextRequest, NextResponse } from "next/server";
import { TripStatus } from "@prisma/client";

import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { CreateTripSchema } from "@/modules/trips/schema";
import { createTrip, listTripsByBranch } from "@/modules/trips/service";

// ---------------------------------------------------------------------------
// GET — public trip listing
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;

  const branchId = searchParams.get("branchId");
  if (!branchId) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "branchId query parameter is required." },
      { status: 400 },
    );
  }

  // Optional date filter — must be a valid calendar date.
  let date: Date | undefined;
  const dateParam = searchParams.get("date");
  if (dateParam) {
    const parsed = new Date(dateParam);
    if (isNaN(parsed.getTime())) {
      return NextResponse.json(
        { code: "VALIDATION_ERROR", message: "Invalid date format. Expected YYYY-MM-DD." },
        { status: 400 },
      );
    }
    date = parsed;
  }

  // Optional status filter — must be a valid TripStatus enum value.
  let status: TripStatus | undefined;
  const statusParam = searchParams.get("status");
  if (statusParam) {
    if (!(statusParam in TripStatus)) {
      return NextResponse.json(
        {
          code: "VALIDATION_ERROR",
          message: `Invalid status. Allowed values: ${Object.values(TripStatus).join(", ")}.`,
        },
        { status: 400 },
      );
    }
    status = statusParam as TripStatus;
  }

  try {
    const trips = await listTripsByBranch({ branchId, date, status });
    return NextResponse.json({ trips });
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
// POST — create a trip (ADMIN only)
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Require an authenticated ADMIN session.
  const session = await auth();

  if (!session) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Authentication required." },
      { status: 401 },
    );
  }

  if (session.user.role !== "PROVIDER") {
    return NextResponse.json(
      { code: "FORBIDDEN", message: "Only the provider can create trips." },
      { status: 403 },
    );
  }

  // 2. Parse request body.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const parsed = CreateTripSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "Invalid request data." },
      { status: 400 },
    );
  }

  // 3. Always derive companyId from the session — never trust the client.
  const tripInput = {
    ...parsed.data,
    companyId: session.user.companyId,
  };

  try {
    const trip = await createTrip({ ...tripInput, actorId: session.user.id });
    return NextResponse.json({ trip }, { status: 201 });
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
