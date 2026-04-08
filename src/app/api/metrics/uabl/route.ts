// GET /api/metrics/uabl?tripId=<id>
// GET /api/metrics/uabl?branchId=<id>&dateFrom=<ISO>&dateTo=<ISO>
// Auth: UABL only

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { assertRole } from "@/lib/permissions";
import { getTripMetrics, getBranchMetrics } from "@/modules/metrics/service";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    assertRole(session.user.role, ["UABL"]);

    const { searchParams } = new URL(req.url);
    const tripId   = searchParams.get("tripId");
    const branchId = searchParams.get("branchId");
    const from     = searchParams.get("dateFrom");
    const to       = searchParams.get("dateTo");

    if (tripId) {
      const data = await getTripMetrics(tripId, session.user.companyId);
      return NextResponse.json(data);
    }

    if (branchId) {
      const dateFrom = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const dateTo   = to   ? new Date(to)   : new Date();
      const data = await getBranchMetrics(session.user.companyId, branchId, dateFrom, dateTo);
      return NextResponse.json(data);
    }

    return NextResponse.json(
      { error: "Se requiere tripId o branchId." },
      { status: 400 },
    );
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: "Error interno." }, { status: 500 });
  }
}
