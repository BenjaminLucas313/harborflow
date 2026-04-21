// =============================================================================
// GET /api/snapshots
// =============================================================================
//
// Returns the last N monthly snapshots for the authenticated user's company,
// each annotated with % variation vs the previous period.
//
// Auth:         UABL only.
// Query params: meses (default 6, max 24)
//
// Response:
//   200 { data: SnapshotConVariacion[] }
//   400 VALIDATION_ERROR
//   401 UNAUTHORIZED
//   403 FORBIDDEN
//   500 INTERNAL_ERROR
//
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { auth }                        from "@/lib/auth";
import { AppError }                    from "@/lib/errors";
import { assertRole }                  from "@/lib/permissions";
import { getSnapshotComparativo }      from "@/services/snapshot.service";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "No autorizado." } },
        { status: 401 },
      );
    }

    assertRole(session.user.role, ["UABL"]);

    const mesesParam = req.nextUrl.searchParams.get("meses");
    const meses      = mesesParam ? parseInt(mesesParam, 10) : 6;

    if (!Number.isInteger(meses) || meses < 1 || meses > 24) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Parámetro 'meses' inválido (1–24)." } },
        { status: 400 },
      );
    }

    const data = await getSnapshotComparativo(session.user.companyId, meses);

    return NextResponse.json({ data });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: err.statusCode },
      );
    }
    console.error("[GET /api/snapshots]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Error interno." } },
      { status: 500 },
    );
  }
}
