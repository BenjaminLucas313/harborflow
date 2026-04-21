// GET /api/metricas
//
// Query params:
//   mes          (optional, 1-12, default = current Argentina month)
//   anio         (optional, default = current Argentina year)
//   departamentoId (optional, filter to a single department)
//
// Auth: UABL only
// Response: { data: AdminMetrics }

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { assertRole } from "@/lib/permissions";
import { getAdminMetrics } from "@/modules/metrics/admin-service";

// Argentina current month/year (UTC-3, no DST).
function argNow(): { mes: number; anio: number } {
  const now = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return { mes: now.getUTCMonth() + 1, anio: now.getUTCFullYear() };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "No autorizado." } }, { status: 401 });

    assertRole(session.user.role, ["UABL"]);

    const { searchParams } = new URL(req.url);
    const { mes: defaultMes, anio: defaultAnio } = argNow();

    const mesParam  = searchParams.get("mes");
    const anioParam = searchParams.get("anio");
    const deptId    = searchParams.get("departamentoId") || undefined;

    const mes  = mesParam  ? Number(mesParam)  : defaultMes;
    const anio = anioParam ? Number(anioParam) : defaultAnio;

    if (!Number.isInteger(mes)  || mes  < 1 || mes  > 12) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Parámetro 'mes' inválido (1-12)." } }, { status: 400 });
    }
    if (!Number.isInteger(anio) || anio < 2020 || anio > 2100) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Parámetro 'anio' inválido." } }, { status: 400 });
    }

    const data = await getAdminMetrics(session.user.companyId, mes, anio, deptId);

    return NextResponse.json({ data });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.statusCode });
    }
    console.error("[GET /api/metricas]", err);
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Error interno." } }, { status: 500 });
  }
}
