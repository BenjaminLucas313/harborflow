// =============================================================================
// GET  /api/informes?mes=<1-12>&anio=<YYYY>  — fetch existing informe
// POST /api/informes                          — generate / regenerate informe
// =============================================================================
//
// Auth: UABL role only. companyId always derived from session.
//
// GET response:
//   200 { data: InformeNarrativo }   (informe exists)
//   204                              (no informe yet for this period)
//
// POST body:  { mes: number, anio: number }
// POST response:
//   201 { data: InformeNarrativo }
//   400 VALIDATION_ERROR
//   401 UNAUTHORIZED
//   403 FORBIDDEN
//   500 INTERNAL_ERROR
//
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { z }                         from "zod";
import { auth }                      from "@/lib/auth";
import {
  generarInformeNarrativo,
  getInformeNarrativo,
}                                    from "@/services/informe.service";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const PeriodSchema = z.object({
  mes:  z.number().int().min(1).max(12),
  anio: z.number().int().min(2000).max(2100),
});

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------

async function requireUabl() {
  const session = await auth();
  if (!session) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Autenticación requerida." } },
        { status: 401 },
      ),
    };
  }
  if (session.user.role !== "UABL") {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Solo usuarios UABL pueden acceder a los informes." } },
        { status: 403 },
      ),
    };
  }
  return {
    ok:        true as const,
    companyId: session.user.companyId,
    userId:    session.user.id,
  };
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const guard = await requireUabl();
    if (!guard.ok) return guard.response;

    const { searchParams } = req.nextUrl;
    const mesRaw  = searchParams.get("mes");
    const anioRaw = searchParams.get("anio");

    const parsed = PeriodSchema.safeParse({
      mes:  mesRaw  ? parseInt(mesRaw,  10) : undefined,
      anio: anioRaw ? parseInt(anioRaw, 10) : undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "mes y anio son requeridos (ej. ?mes=4&anio=2026)." } },
        { status: 400 },
      );
    }

    const { mes, anio } = parsed.data;
    const informe = await getInformeNarrativo(guard.companyId, mes, anio);

    if (!informe) {
      return new NextResponse(null, { status: 204 });
    }

    return NextResponse.json({ data: informe });
  } catch (err) {
    console.error("[GET /api/informes]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Error interno." } },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const guard = await requireUabl();
    if (!guard.ok) return guard.response;

    const rawBody = await req.json().catch(() => null);
    const parsed  = PeriodSchema.safeParse(rawBody);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: firstIssue?.message ?? "mes y anio son requeridos." } },
        { status: 400 },
      );
    }

    const { mes, anio } = parsed.data;

    const informe = await generarInformeNarrativo({
      companyId: guard.companyId,
      mes,
      anio,
      actorId:   guard.userId,
    });

    return NextResponse.json({ data: informe }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/informes]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Error al generar el informe. Verificá la API key o intentá más tarde." } },
      { status: 500 },
    );
  }
}
