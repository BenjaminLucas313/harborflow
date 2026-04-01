// GET /api/trips  — list trips for a branch (query params: branchId, date, status)
// POST /api/trips — create a new trip (admin only)
// All business logic lives in modules/trips/service.ts.
import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest): Promise<NextResponse> {
  // TODO: validate query params, call trips service, return response.
  return NextResponse.json({ message: "not implemented" }, { status: 501 });
}

export async function POST(_req: NextRequest): Promise<NextResponse> {
  // TODO: assert ADMIN role, validate body with CreateTripSchema, call trips service.
  return NextResponse.json({ message: "not implemented" }, { status: 501 });
}
