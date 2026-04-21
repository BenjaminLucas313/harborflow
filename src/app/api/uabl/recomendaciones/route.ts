// =============================================================================
// /api/uabl/recomendaciones
// =============================================================================
//
// GET  ?mes=<1-12>&anio=<YYYY>
//   Returns all RecomendacionIA for the company, optionally filtered by period.
//   Response: { recomendaciones: RecomendacionIA[] }
//
// POST { mes, anio }
//   Queries real operational data, calls Claude API to generate 3 recommendations,
//   deletes existing ACTIVA recommendations for the period, persists the new ones.
//   Response: { recomendaciones: RecomendacionIA[] }   (201)
//
// Auth: UABL role only. companyId always derived from session.
//
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAdminMetrics, getEficienciaMetrics } from "@/modules/metrics/admin-service";
import { PrioridadIA } from "@prisma/client";

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const PostBodySchema = z.object({
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
        { error: { code: "FORBIDDEN", message: "Solo usuarios UABL." } },
        { status: 403 },
      ),
    };
  }
  return { ok: true as const, companyId: session.user.companyId };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

const PRIORIDAD_MAP: Record<string, PrioridadIA> = {
  alta: "ALTA", media: "MEDIA", baja: "BAJA",
  ALTA: "ALTA", MEDIA: "MEDIA", BAJA: "BAJA",
};

// Shape Claude is asked to produce
type RawRecomendacion = {
  titulo:                 string;
  descripcion:            string;
  ahorroEstimadoAsientos: number;
  prioridad:              string;
};

type ClaudeResponse = {
  recomendaciones: RawRecomendacion[];
};

// ---------------------------------------------------------------------------
// GET — list active recommendations
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const guard = await requireUabl();
    if (!guard.ok) return guard.response;

    const { searchParams } = req.nextUrl;
    const mesParam  = searchParams.get("mes");
    const anioParam = searchParams.get("anio");

    const mes  = mesParam  ? parseInt(mesParam,  10) : undefined;
    const anio = anioParam ? parseInt(anioParam, 10) : undefined;

    const recomendaciones = await prisma.recomendacionIA.findMany({
      where: {
        companyId: guard.companyId,
        ...(mes  !== undefined && !isNaN(mes)  ? { mes }  : {}),
        ...(anio !== undefined && !isNaN(anio) ? { anio } : {}),
      },
      orderBy: [
        { prioridad: "asc" },    // ALTA → MEDIA → BAJA (declaration order in enum)
        { createdAt: "desc" },
      ],
    });

    return NextResponse.json({ recomendaciones });
  } catch (err) {
    // Always return valid JSON — never an empty body.
    // Common failure cause: migration not yet applied (table doesn't exist).
    console.error("[GET /api/uabl/recomendaciones]", err);
    return NextResponse.json({ recomendaciones: [] });
  }
}

// ---------------------------------------------------------------------------
// POST — generate new recommendations via Claude
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  const guard = await requireUabl();
  if (!guard.ok) return guard.response;

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
      { error: { code: "VALIDATION_ERROR", message: "mes y anio son requeridos." } },
      { status: 400 },
    );
  }

  const { mes, anio } = parsed.data;
  const { companyId } = guard;

  // Gather real operational data
  const [metrics, eficiencia] = await Promise.all([
    getAdminMetrics(companyId, mes, anio),
    getEficienciaMetrics(companyId, mes, anio),
  ]);

  const mesNombre = MONTH_NAMES[mes - 1] ?? `Mes ${mes}`;

  const context = `
PERÍODO: ${mesNombre} ${anio}
Total viajes: ${metrics.totalViajesDelPeriodo}
Ocupación promedio: ${(metrics.promedioOcupacion * 100).toFixed(1)}%
Viajes sin liquidar: ${metrics.viajesSinLiquidar}

DEPARTAMENTOS (confirmados / pendientes):
${
  metrics.resumenPorDepto
    .sort((a, b) => b.asientosConfirmados - a.asientosConfirmados)
    .map((d) => `- ${d.departamentoNombre}: ${d.asientosConfirmados} conf, ${d.asientosPendientes} pend`)
    .join("\n") || "- Sin datos"
}

LANCHAS CON BAJA OCUPACIÓN (< 60%):
${
  eficiencia.lanchasBajaOcupacion
    .map((l) => `- ${l.boatName}: ${(l.promedioOcupacion * 100).toFixed(1)}% en ${l.viajesCount} viajes`)
    .join("\n") || "- Ninguna"
}

DEPARTAMENTOS QUE FRECUENTEMENTE VIAJAN SOLOS:
${
  eficiencia.deptosSolosFrecuentes
    .map((d) => `- ${d.departamentoNombre}: ${d.vecesViajaSolo} veces solo`)
    .join("\n") || "- Ninguno"
}

HORARIOS ALTA DEMANDA:
${
  eficiencia.horariosAltaDemanda
    .map((h) => `- ${h.hora}:00 hs: ${h.totalAsientos} asientos en ${h.totalViajes} viajes`)
    .join("\n") || "- Sin datos"
}
`.trim();

  // Call Claude API for recommendations
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let claudeResponse: ClaudeResponse;
  try {
    const message = await anthropic.messages.create({
      model:      "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system:
        "Sos el UABL Assistant, asistente de eficiencia operativa del sistema HarborFlow " +
        "para UABL Puerto Rosario Argentina. " +
        "Analizás datos operativos reales y generás recomendaciones accionables y específicas. " +
        "Respondé SOLO con JSON válido, sin texto adicional antes ni después del JSON.",
      messages: [
        {
          role:    "user",
          content:
            `Basándote en estos datos operativos reales:\n${context}\n\n` +
            "Generá exactamente 3 recomendaciones de eficiencia operativa. " +
            "Respondé ÚNICAMENTE con este JSON (sin markdown, sin texto extra):\n" +
            '{"recomendaciones":[{"titulo":"string (máx 70 chars)","descripcion":"string (máx 220 chars)","ahorroEstimadoAsientos":number,"prioridad":"alta"|"media"|"baja"}]}',
        },
      ],
    });

    const rawText = message.content[0]?.type === "text" ? message.content[0].text.trim() : "";

    // Extract JSON — Claude sometimes wraps it in markdown fences
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in Claude response");

    claudeResponse = JSON.parse(jsonMatch[0]) as ClaudeResponse;
  } catch (err) {
    console.error("[POST /api/uabl/recomendaciones] Claude error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Error al procesar respuesta de IA. Intentá de nuevo." } },
      { status: 500 },
    );
  }

  // Validate that we got 3 usable recommendations
  if (
    !Array.isArray(claudeResponse.recomendaciones) ||
    claudeResponse.recomendaciones.length === 0
  ) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "La IA no devolvió recomendaciones válidas." } },
      { status: 500 },
    );
  }

  // Delete existing ACTIVA recommendations for this period to avoid duplicates
  await prisma.recomendacionIA.deleteMany({
    where: { companyId, mes, anio, estado: "ACTIVA" },
  });

  // Persist new recommendations and return them
  const created = await prisma.recomendacionIA.createManyAndReturn({
    data: claudeResponse.recomendaciones.slice(0, 3).map((r) => ({
      companyId,
      titulo:                 String(r.titulo).slice(0, 70),
      descripcion:            String(r.descripcion).slice(0, 220),
      ahorroEstimadoAsientos: Math.max(0, Math.round(Number(r.ahorroEstimadoAsientos) || 0)),
      prioridad:              PRIORIDAD_MAP[r.prioridad] ?? "MEDIA",
      mes,
      anio,
    })),
  });

  return NextResponse.json({ recomendaciones: created }, { status: 201 });
}
