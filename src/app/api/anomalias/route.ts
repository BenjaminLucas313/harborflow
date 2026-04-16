// =============================================================================
// GET /api/anomalias
// =============================================================================
//
// Returns real-time operational anomalies for the authenticated user's company.
//
// Auth:   UABL or PROVEEDOR.
// Cache:  private, max-age=300 (5 min) — results are company-scoped so no
//         shared-cache risks, but let the client reuse the response briefly.
//
// Response:
//   200 { anomalias: Anomalia[], generadoEn: string }
//   401 UNAUTHORIZED
//   403 FORBIDDEN
//   500 INTERNAL_ERROR
//
// =============================================================================

import { NextResponse }       from "next/server";
import { auth }               from "@/lib/auth";
import { AppError }           from "@/lib/errors";
import { assertRole }         from "@/lib/permissions";
import { detectarAnomalias }  from "@/services/anomalias.service";

export async function GET(): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "No autorizado." } },
        { status: 401 },
      );
    }

    assertRole(session.user.role, ["UABL", "PROVEEDOR"]);

    const anomalias   = await detectarAnomalias(session.user.companyId);
    const generadoEn  = new Date().toISOString();

    return NextResponse.json(
      { anomalias, generadoEn },
      {
        headers: {
          "Cache-Control": "private, max-age=300",
        },
      },
    );
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: err.statusCode },
      );
    }
    console.error("[GET /api/anomalias]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Error interno." } },
      { status: 500 },
    );
  }
}
