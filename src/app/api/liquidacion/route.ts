// =============================================================================
// /api/liquidacion — Liquidation endpoints
// =============================================================================
//
// GET  /api/liquidacion?viajeId=<id>
//   Returns the per-department distribution for a specific trip.
//   Response: { data: LiquidacionDetalleItem[] }
//
// GET  /api/liquidacion?mes=<1-12>&anio=<YYYY>[&departamentoId=<id>]
//   Returns the monthly summary grouped by department.
//   Response: { data: ResumenMensualItem[] }
//
// POST /api/liquidacion
//   Body: { viajeId: string }
//   Triggers (or returns cached) liquidation calculation for one trip.
//   Response: { data: CalcDistribucionResult }
//
// AUTH: all endpoints require an authenticated UABL session.
//       companyId is always derived from the session — never from the client.
//
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import {
  calcularDistribucionViaje,
  getResumenMensual,
  getLiquidacionesPorViaje,
} from "@/services/liquidacion.service";

// =============================================================================
// Input schemas
// =============================================================================

const PostBodySchema = z.object({
  viajeId: z.string().min(1, "viajeId es requerido."),
});

// =============================================================================
// Auth guard helper
// =============================================================================

type AuthGuardResult =
  | { ok: true; userId: string; companyId: string }
  | { ok: false; response: NextResponse };

async function requireUabl(): Promise<AuthGuardResult> {
  const session = await auth();

  if (!session) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Autenticación requerida." } },
        { status: 401 },
      ),
    };
  }

  if (session.user.role !== "UABL") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Solo usuarios UABL pueden acceder a la liquidación." } },
        { status: 403 },
      ),
    };
  }

  return { ok: true, userId: session.user.id, companyId: session.user.companyId };
}

// =============================================================================
// GET — detail by viajeId OR monthly summary by mes+anio
// =============================================================================

export async function GET(req: NextRequest): Promise<NextResponse> {
  const guard = await requireUabl();
  if (!guard.ok) return guard.response;

  const { searchParams } = req.nextUrl;
  const viajeId      = searchParams.get("viajeId");
  const mesParam     = searchParams.get("mes");
  const anioParam    = searchParams.get("anio");
  const deptIdParam  = searchParams.get("departamentoId");

  // ── Branch A: trip detail ──────────────────────────────────────────────────
  if (viajeId) {
    try {
      const data = await getLiquidacionesPorViaje(viajeId);
      return NextResponse.json({ data });
    } catch (err) {
      return handleError(err);
    }
  }

  // ── Branch B: monthly summary ──────────────────────────────────────────────
  if (mesParam || anioParam) {
    const mes  = parseInt(mesParam  ?? "", 10);
    const anio = parseInt(anioParam ?? "", 10);

    if (isNaN(mes) || mes < 1 || mes > 12) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "mes debe ser un número entre 1 y 12." } },
        { status: 400 },
      );
    }

    if (isNaN(anio) || anio < 2000 || anio > 2100) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "anio debe ser un número de 4 dígitos válido." } },
        { status: 400 },
      );
    }

    try {
      const data = await getResumenMensual(mes, anio, deptIdParam ?? undefined);
      return NextResponse.json({ data });
    } catch (err) {
      return handleError(err);
    }
  }

  // ── No valid params provided ───────────────────────────────────────────────
  return NextResponse.json(
    {
      error: {
        code: "VALIDATION_ERROR",
        message: "Provide either viajeId or mes+anio query parameters.",
      },
    },
    { status: 400 },
  );
}

// =============================================================================
// POST — trigger liquidation for a trip
// =============================================================================

export async function POST(req: NextRequest): Promise<NextResponse> {
  const guard = await requireUabl();
  if (!guard.ok) return guard.response;

  // Parse body.
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "JSON inválido." } },
      { status: 400 },
    );
  }

  const parsed = PostBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Datos de solicitud inválidos.",
          fields: Object.fromEntries(
            parsed.error.issues.map((i) => [
              i.path.join(".") || "_root",
              i.message,
            ]),
          ),
        },
      },
      { status: 400 },
    );
  }

  try {
    const data = await calcularDistribucionViaje(
      parsed.data.viajeId,
      guard.userId,
    );
    const status = data.cached ? 200 : 201;
    return NextResponse.json({ data }, { status });
  } catch (err) {
    return handleError(err);
  }
}

// =============================================================================
// Shared error handler
// =============================================================================

function handleError(err: unknown): NextResponse {
  if (err instanceof AppError) {
    const status =
      err.statusCode === 404 ? 404
      : err.statusCode === 422 ? 422
      : err.statusCode === 403 ? 403
      : 400;
    return NextResponse.json(
      { error: { code: err.code, message: err.message } },
      { status },
    );
  }

  console.error("[/api/liquidacion] unexpected error:", err);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Error interno del servidor." } },
    { status: 500 },
  );
}
