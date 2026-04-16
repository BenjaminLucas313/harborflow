// =============================================================================
// Informe Narrativo Service
// =============================================================================
//
// Generates and retrieves InformeNarrativo records — one per company per month.
//
// generarInformeNarrativo:
//   1. Fetches SnapshotMensual for the requested period (+ previous month).
//   2. Detects current operational anomalies.
//   3. Fetches RecomendacionIA with estado = IMPLEMENTADA for the period.
//   4. Calls Claude API (claude-sonnet-4-6) to produce a ~300-word markdown brief.
//   5. Upserts InformeNarrativo — idempotent: regenerating overwrites the text.
//
// Design notes:
//   - All DB fetches run in parallel before the Claude call.
//   - logAction is fire-and-forget (never blocks response).
//   - If the Claude call fails, the error propagates to the caller (route handler
//     is responsible for returning an appropriate HTTP error).
// =============================================================================

import Anthropic     from "@anthropic-ai/sdk";
import { prisma }    from "@/lib/prisma";
import { detectarAnomalias } from "./anomalias.service";
import { logAction } from "@/modules/audit/repository";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function prevPeriod(mes: number, anio: number): { mes: number; anio: number } {
  return mes === 1 ? { mes: 12, anio: anio - 1 } : { mes: mes - 1, anio };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GenerarInformeInput = {
  companyId: string;
  mes:       number;
  anio:      number;
  actorId:   string;
};

// ---------------------------------------------------------------------------
// generarInformeNarrativo
// ---------------------------------------------------------------------------

/**
 * Generates (or regenerates) the monthly narrative report for a company.
 *
 * Returns the persisted InformeNarrativo record. Throws if the Claude API
 * call fails — callers should handle this and return a 500 to the client.
 */
export async function generarInformeNarrativo(input: GenerarInformeInput) {
  const { companyId, mes, anio, actorId } = input;
  const prev       = prevPeriod(mes, anio);
  const mesNombre  = MONTH_NAMES[mes - 1]      ?? `Mes ${mes}`;
  const prevNombre = MONTH_NAMES[prev.mes - 1] ?? `Mes ${prev.mes}`;

  // ── 1. Fetch all context in parallel ───────────────────────────────────────
  const [snapshotActual, snapshotAnterior, anomalias, recomendaciones] =
    await Promise.all([
      prisma.snapshotMensual.findFirst({
        where: { companyId, mes, anio },
      }),
      prisma.snapshotMensual.findFirst({
        where: { companyId, mes: prev.mes, anio: prev.anio },
      }),
      detectarAnomalias(companyId),
      prisma.recomendacionIA.findMany({
        where:   { companyId, mes, anio, estado: "IMPLEMENTADA" },
        select:  { titulo: true, descripcion: true, ahorroEstimadoAsientos: true },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

  // ── 2. Build context string ────────────────────────────────────────────────
  let context = `PERÍODO: ${mesNombre} ${anio}\n\n`;

  // Current period snapshot
  if (snapshotActual) {
    const ocup = parseFloat(snapshotActual.promedioOcupacion.toString());
    context +=
      `RESUMEN OPERATIVO ${mesNombre.toUpperCase()} ${anio}:\n` +
      `- Total viajes: ${snapshotActual.totalViajes}\n` +
      `- Ocupación promedio: ${(ocup * 100).toFixed(1)}%\n` +
      `- Asientos ocupados: ${snapshotActual.totalAsientosOcupados}\n` +
      `- Asientos vacíos: ${snapshotActual.totalAsientosVacios}\n` +
      `- Cancelaciones: ${snapshotActual.cancelaciones}\n` +
      `- Viajes con baja ocupación (<40%): ${snapshotActual.viajesBajaOcupacion}\n`;
  } else {
    context += `RESUMEN OPERATIVO: Sin datos de snapshot para ${mesNombre} ${anio}.\n`;
  }

  // Previous month comparison
  if (snapshotAnterior) {
    const ocupPrev = parseFloat(snapshotAnterior.promedioOcupacion.toString());
    context +=
      `\nCOMPARATIVA MES ANTERIOR (${prevNombre} ${prev.anio}):\n` +
      `- Total viajes: ${snapshotAnterior.totalViajes}\n` +
      `- Ocupación promedio: ${(ocupPrev * 100).toFixed(1)}%\n` +
      `- Cancelaciones: ${snapshotAnterior.cancelaciones}\n`;
  } else {
    context += `\nCOMPARATIVA: Sin datos del período anterior (${prevNombre} ${prev.anio}).\n`;
  }

  // Top anomalies (at most 5 — keeps the prompt focused)
  const topAnomalias = anomalias.slice(0, 5);
  if (topAnomalias.length > 0) {
    context += `\nANOMALÍAS OPERATIVAS ACTUALES (top ${topAnomalias.length}):\n`;
    for (const a of topAnomalias) {
      context += `- [${a.severidad.toUpperCase()}] ${a.titulo}: ${a.descripcion}\n`;
    }
  } else {
    context += `\nANOMALÍAS: Sin anomalías activas detectadas.\n`;
  }

  // Implemented recommendations
  if (recomendaciones.length > 0) {
    context += `\nRECOMENDACIONES IA IMPLEMENTADAS ESTE PERÍODO:\n`;
    for (const r of recomendaciones) {
      context +=
        `- ${r.titulo} ` +
        `(ahorro estimado: ${r.ahorroEstimadoAsientos} asientos/mes): ` +
        `${r.descripcion}\n`;
    }
  } else {
    context += `\nRECOMENDACIONES IMPLEMENTADAS: Ninguna registrada para este período.\n`;
  }

  // ── 3. Call Claude API ────────────────────────────────────────────────────
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await anthropic.messages.create({
    model:      "claude-sonnet-4-6",
    max_tokens: 1024,
    system:
      "Sos el analista de operaciones de HarborFlow para UABL Puerto Rosario Argentina. " +
      "Tu tarea es redactar un informe ejecutivo mensual conciso (~300 palabras) en español " +
      "basado exclusivamente en los datos reales que te pasan como contexto. " +
      "El informe debe: " +
      "(1) resumir el desempeño operativo del período con las métricas clave, " +
      "(2) comparar con el mes anterior si hay datos disponibles, " +
      "(3) mencionar las anomalías más relevantes sin alarmismo innecesario, " +
      "(4) destacar las mejoras implementadas si las hay, " +
      "(5) cerrar con 2-3 líneas de conclusión y próximos pasos sugeridos. " +
      "Formato: markdown con encabezados ## por sección, negritas para cifras clave, " +
      "listas cortas donde corresponda. " +
      "Nunca inventés datos. Si falta información para una sección, indicalo en una oración.",
    messages: [
      {
        role:    "user",
        content: `Datos operativos reales:\n\n${context}\n\nRedactá el informe ejecutivo mensual.`,
      },
    ],
  });

  const contenido =
    message.content[0]?.type === "text"
      ? message.content[0].text
      : "No se pudo generar el informe.";

  // ── 4. Upsert — idempotent ────────────────────────────────────────────────
  const informe = await prisma.informeNarrativo.upsert({
    where:  { companyId_mes_anio: { companyId, mes, anio } },
    create: { companyId, mes, anio, contenido },
    update: { contenido, generadoEn: new Date() },
  });

  // ── 5. Audit (fire-and-forget) ────────────────────────────────────────────
  logAction({
    companyId,
    actorId,
    action:     "INFORME_GENERADO",
    entityType: "InformeNarrativo",
    entityId:   informe.id,
    payload:    { mes, anio },
  }).catch(() => {});

  return informe;
}

// ---------------------------------------------------------------------------
// getInformeNarrativo
// ---------------------------------------------------------------------------

/**
 * Returns the latest InformeNarrativo for a given company and period, or null.
 */
export async function getInformeNarrativo(
  companyId: string,
  mes:       number,
  anio:      number,
) {
  return prisma.informeNarrativo.findFirst({
    where: { companyId, mes, anio },
  });
}
