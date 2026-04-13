// GET /api/metricas/export
//
// Returns a UTF-8 CSV file with the department liquidation summary.
// Triggers a browser file download via Content-Disposition: attachment.
//
// Query params: same as /api/metricas (mes, anio, departamentoId)
// Auth: ADMIN only

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { assertRole } from "@/lib/permissions";
import { getAdminMetrics } from "@/modules/metrics/admin-service";
import type { DeptoResumen } from "@/modules/metrics/admin-service";

function argNow(): { mes: number; anio: number } {
  const now = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return { mes: now.getUTCMonth() + 1, anio: now.getUTCFullYear() };
}

/** Escape a CSV field value: wrap in quotes if it contains comma, quote, or newline. */
function csvField(value: string | number | boolean): string {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildCSV(rows: DeptoResumen[], mes: number, anio: number): string {
  const MONTH_NAMES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];
  const header = [
    `# HarborFlow — Métricas de liquidación`,
    `# Período: ${MONTH_NAMES[mes - 1]} ${anio}`,
    `# Generado: ${new Date().toISOString()}`,
    "",
    [
      "Departamento",
      "Asientos Confirmados",
      "Asientos Pendientes",
      "Total Asientos Liquidados",
      "Viajes Liquidados",
      "Liquidado",
    ].map(csvField).join(","),
  ].join("\n");

  const body = rows
    .map((r) =>
      [
        r.departamentoNombre,
        r.asientosConfirmados,
        r.asientosPendientes,
        r.totalAsientosLiq.toFixed(4),
        r.viajesLiquidados,
        r.liquidado ? "Sí" : "No",
      ]
        .map(csvField)
        .join(","),
    )
    .join("\n");

  // Totals row
  const totalConfirmados = rows.reduce((s, r) => s + r.asientosConfirmados, 0);
  const totalPendientes  = rows.reduce((s, r) => s + r.asientosPendientes,  0);
  const totalLiq         = rows.reduce((s, r) => s + r.totalAsientosLiq,    0);
  const totalViajes      = rows.reduce((s, r) => s + r.viajesLiquidados,    0);
  const totalsRow = [
    "TOTAL",
    totalConfirmados,
    totalPendientes,
    totalLiq.toFixed(4),
    totalViajes,
    "",
  ]
    .map(csvField)
    .join(",");

  return `${header}\n${body}\n${totalsRow}`;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "No autorizado." } }, { status: 401 });

    assertRole(session.user.role, ["ADMIN"]);

    const { searchParams } = new URL(req.url);
    const { mes: defaultMes, anio: defaultAnio } = argNow();

    const mes  = Number(searchParams.get("mes")  ?? defaultMes);
    const anio = Number(searchParams.get("anio") ?? defaultAnio);
    const deptId = searchParams.get("departamentoId") || undefined;

    if (!Number.isInteger(mes)  || mes  < 1 || mes  > 12) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Parámetro 'mes' inválido." } }, { status: 400 });
    }
    if (!Number.isInteger(anio) || anio < 2020 || anio > 2100) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Parámetro 'anio' inválido." } }, { status: 400 });
    }

    const metrics = await getAdminMetrics(session.user.companyId, mes, anio, deptId);
    const csv     = buildCSV(metrics.resumenPorDepto, mes, anio);
    const filename = `metricas-${anio}-${String(mes).padStart(2, "0")}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type":        "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.statusCode });
    }
    console.error("[GET /api/metricas/export]", err);
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Error interno." } }, { status: 500 });
  }
}
