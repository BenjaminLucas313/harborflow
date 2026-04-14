// GET /api/metricas/export/pdf
//
// Generates and returns a liquidation summary PDF for the requested period.
// Uses the same query params as GET /api/metricas.
//
// Query params:
//   mes           — 1–12 (default: current Argentina month)
//   anio          — 2020–2100 (default: current Argentina year)
//   departamentoId — optional; filter to one department
//
// Auth: UABL only.
//
// Response:
//   200  application/pdf — attachment
//   400  VALIDATION_ERROR
//   401  UNAUTHORIZED
//   403  FORBIDDEN
//   500  INTERNAL_ERROR

import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer }            from "@react-pdf/renderer";
import type { DocumentProps }        from "@react-pdf/renderer";
import React                         from "react";

import { auth }               from "@/lib/auth";
import { AppError }           from "@/lib/errors";
import { assertRole }         from "@/lib/permissions";
import { getAdminMetrics }    from "@/modules/metrics/admin-service";
import { ResumenMetricasPdf } from "@/components/pdf/ResumenMetricasPdf";
import { prisma }             from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function argNow(): { mes: number; anio: number } {
  const now = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return { mes: now.getUTCMonth() + 1, anio: now.getUTCFullYear() };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

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

    const { searchParams }                 = new URL(req.url);
    const { mes: defaultMes, anio: defaultAnio } = argNow();

    const mes   = Number(searchParams.get("mes")  ?? defaultMes);
    const anio  = Number(searchParams.get("anio") ?? defaultAnio);
    const deptId = searchParams.get("departamentoId") || undefined;

    if (!Number.isInteger(mes)  || mes  < 1  || mes  > 12) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Parámetro 'mes' inválido." } },
        { status: 400 },
      );
    }
    if (!Number.isInteger(anio) || anio < 2020 || anio > 2100) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Parámetro 'anio' inválido." } },
        { status: 400 },
      );
    }

    // ── 1. Fetch metrics ─────────────────────────────────────────────────────
    const { companyId } = session.user;
    const metrics = await getAdminMetrics(companyId, mes, anio, deptId);

    // ── 2. Resolve optional department name for the report subtitle ──────────
    let departamentoNombre: string | undefined;
    if (deptId) {
      const dept = await prisma.department.findUnique({
        where:  { id: deptId },
        select: { name: true },
      });
      departamentoNombre = dept?.name;
    }

    // ── 3. Render PDF ────────────────────────────────────────────────────────
    const generatedAt = new Date();

    const buffer = await renderToBuffer(
      React.createElement(ResumenMetricasPdf, {
        metrics,
        mes,
        anio,
        generatedAt,
        departamentoNombre,
      }) as React.ReactElement<DocumentProps>,
    );

    // ── 4. Return PDF ────────────────────────────────────────────────────────
    const filename = `metricas-${anio}-${String(mes).padStart(2, "0")}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":        "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control":       "no-store",
      },
    });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: err.statusCode },
      );
    }
    console.error("[GET /api/metricas/export/pdf]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Error al generar el PDF." } },
      { status: 500 },
    );
  }
}
