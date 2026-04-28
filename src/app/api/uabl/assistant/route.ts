// =============================================================================
// POST /api/uabl/assistant
// =============================================================================
//
// Receives a question from the UABL operator, queries the DB for real
// operational context, and calls the Claude API to generate a grounded answer.
//
// Body: { pregunta: string, mes: number, anio: number }
// Response: { respuesta: string }
// Auth: UABL role only. companyId always derived from session.
//
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAdminMetrics, getEficienciaMetrics } from "@/modules/metrics/admin-service";
import { getTripRoute } from "@/lib/trip-utils";

// ---------------------------------------------------------------------------
// Rate limiter — in-memory, per user, resets on deploy (V1 acceptable)
// ---------------------------------------------------------------------------

type RateLimitEntry = { count: number; resetAt: number };
const rateLimitMap = new Map<string, RateLimitEntry>();
const HOURLY_LIMIT = 20;

function checkRateLimit(userId: string): { allowed: boolean; minutesLeft?: number } {
  const now   = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || entry.resetAt <= now) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return { allowed: true };
  }
  if (entry.count >= HOURLY_LIMIT) {
    return { allowed: false, minutesLeft: Math.ceil((entry.resetAt - now) / 60_000) };
  }
  entry.count += 1;
  return { allowed: true };
}

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const BodySchema = z.object({
  pregunta: z.string().min(1).max(600),
  mes:      z.number().int().min(1).max(12),
  anio:     z.number().int().min(2000).max(2100),
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
        { error: { code: "FORBIDDEN", message: "Solo usuarios UABL pueden usar el asistente." } },
        { status: 403 },
      ),
    };
  }
  return { ok: true as const, companyId: session.user.companyId, userId: session.user.id };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

/** Returns UTC timestamp range for a calendar day in Argentina (UTC-3). */
function argDayRange(offsetDays: number): { from: Date; to: Date } {
  const nowUtc  = new Date();
  const argDate = new Date(nowUtc.getTime() - 3 * 60 * 60 * 1000);
  const dayStart = new Date(Date.UTC(
    argDate.getUTCFullYear(),
    argDate.getUTCMonth(),
    argDate.getUTCDate() + offsetDays,
    3, 0, 0, 0,   // 00:00 ART = 03:00 UTC
  ));
  return { from: dayStart, to: new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1) };
}

/** Formats a UTC Date as "HH:MM" in Argentina timezone. */
function toArgTime(date: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour:     "2-digit",
    minute:   "2-digit",
    hour12:   false,
  }).format(date);
}

/** Formats a UTC Date as "DD/MM" in Argentina timezone. */
function toArgDate(date: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day:      "2-digit",
    month:    "2-digit",
  }).format(date);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ViajeProximo = {
  tripId:      string;
  hora:        string;
  boatName:    string;
  driverName:  string | null;
  ruta:        string;
  status:      string;
  confirmados: number;
  capacidad:   number;
  porDepto:    { nombre: string; count: number }[];
};

type Viaje7Dias = {
  fecha:       string;
  hora:        string;
  boatName:    string;
  status:      string;
  confirmados: number;
  capacidad:   number;
  pct:         string;
};

// ---------------------------------------------------------------------------
// Data fetchers
// ---------------------------------------------------------------------------

/** Today + tomorrow trips with driver, route, per-dept passenger breakdown. */
async function getViajesProximos(
  companyId: string,
): Promise<{ hoy: ViajeProximo[]; manana: ViajeProximo[] }> {
  const { from: hoyFrom, to: hoyTo } = argDayRange(0);
  const { to: manTo }                = argDayRange(1);

  const trips = await prisma.trip.findMany({
    where: {
      companyId,
      departureTime: { gte: hoyFrom, lte: manTo },
      status:        { notIn: ["CANCELLED"] },
    },
    select: {
      id:            true,
      departureTime: true,
      capacity:      true,
      status:        true,
      boat:   { select: { name: true } },
      driver: { select: { firstName: true, lastName: true } },
      stops:  { select: { order: true, name: true }, orderBy: { order: "asc" as const } },
    },
    orderBy: { departureTime: "asc" },
  });

  if (trips.length === 0) return { hoy: [], manana: [] };

  const tripIds = trips.map((t) => t.id);

  // Single slot query — individual rows with dept name (avoids a second groupBy)
  const slots = await prisma.passengerSlot.findMany({
    where: {
      companyId,
      tripId: { in: tripIds },
      status: { in: ["PENDING", "CONFIRMED"] },
    },
    select: {
      tripId:     true,
      department: { select: { name: true } },
    },
  });

  // Build total count map and per-dept map from the same slot list
  const totalMap = new Map<string, number>();
  const deptMap  = new Map<string, Map<string, number>>();
  for (const slot of slots) {
    totalMap.set(slot.tripId, (totalMap.get(slot.tripId) ?? 0) + 1);
    if (!deptMap.has(slot.tripId)) deptMap.set(slot.tripId, new Map());
    const inner = deptMap.get(slot.tripId)!;
    const name  = slot.department.name;
    inner.set(name, (inner.get(name) ?? 0) + 1);
  }

  const toViaje = (t: typeof trips[number]): ViajeProximo => ({
    tripId:      t.id,
    hora:        toArgTime(t.departureTime),
    boatName:    t.boat.name,
    driverName:  t.driver ? `${t.driver.firstName} ${t.driver.lastName}` : null,
    ruta:        getTripRoute(t.stops),
    status:      t.status,
    confirmados: totalMap.get(t.id) ?? 0,
    capacidad:   t.capacity,
    porDepto: Array.from((deptMap.get(t.id) ?? new Map()).entries())
      .map(([nombre, count]) => ({ nombre, count }))
      .sort((a, b) => b.count - a.count),
  });

  const hoy    = trips.filter((t) => t.departureTime >= hoyFrom && t.departureTime <= hoyTo).map(toViaje);
  const manana = trips.filter((t) => t.departureTime > hoyTo).map(toViaje);

  return { hoy, manana };
}

/** Last 7 calendar days (including today) with per-trip occupancy. Capped at 20 records. */
async function getUltimos7Dias(companyId: string): Promise<Viaje7Dias[]> {
  const { from: sevenDaysAgo } = argDayRange(-6);
  const { to: hoyTo }          = argDayRange(0);

  const trips = await prisma.trip.findMany({
    where: {
      companyId,
      departureTime: { gte: sevenDaysAgo, lte: hoyTo },
      status:        { notIn: ["CANCELLED"] },
    },
    select: {
      id:            true,
      departureTime: true,
      capacity:      true,
      status:        true,
      boat:          { select: { name: true } },
    },
    orderBy: { departureTime: "desc" },
    take:    20,
  });

  if (trips.length === 0) return [];

  const tripIds = trips.map((t) => t.id);
  const slotGroups = await prisma.passengerSlot.groupBy({
    by:    ["tripId"],
    where: { companyId, tripId: { in: tripIds }, status: { in: ["PENDING", "CONFIRMED"] } },
    _count: { id: true },
  });
  const slotMap = new Map(slotGroups.map((g) => [g.tripId, g._count.id]));

  return trips.map((t) => {
    const conf = slotMap.get(t.id) ?? 0;
    return {
      fecha:       toArgDate(t.departureTime),
      hora:        toArgTime(t.departureTime),
      boatName:    t.boat.name,
      status:      t.status,
      confirmados: conf,
      capacidad:   t.capacity,
      pct:         t.capacity > 0 ? `${((conf / t.capacity) * 100).toFixed(1)}%` : "0%",
    };
  });
}

/** Active drivers / choferes for this company. */
async function getChoferesActivos(companyId: string) {
  return prisma.driver.findMany({
    where:   { companyId, isActive: true },
    select:  { firstName: true, lastName: true, licenseNumber: true },
    orderBy: { firstName: "asc" },
  });
}

/** Registered employer companies (clients) for this company. */
async function getEmpleadoresActivos(companyId: string) {
  return prisma.employer.findMany({
    where:   { companyId, isActive: true },
    select:  { name: true, taxId: true },
    orderBy: { name: "asc" },
  });
}

/** Most recent port status record for this company. */
async function getPortStatusActual(companyId: string) {
  return prisma.portStatus.findFirst({
    where:   { companyId },
    orderBy: { createdAt: "desc" },
    select: {
      status:               true,
      message:              true,
      estimatedReopeningAt: true,
      createdAt:            true,
      branch:               { select: { name: true } },
    },
  });
}

// ---------------------------------------------------------------------------
// Context builder
// ---------------------------------------------------------------------------

function buildContext(
  metrics:     Awaited<ReturnType<typeof getAdminMetrics>>,
  eficiencia:  Awaited<ReturnType<typeof getEficienciaMetrics>>,
  proximos:    { hoy: ViajeProximo[]; manana: ViajeProximo[] },
  viajes7:     Viaje7Dias[],
  choferes:    Awaited<ReturnType<typeof getChoferesActivos>>,
  empleadores: Awaited<ReturnType<typeof getEmpleadoresActivos>>,
  portStatus:  Awaited<ReturnType<typeof getPortStatusActual>>,
  mes:         number,
  anio:        number,
): string {
  const mesNombre = MONTH_NAMES[mes - 1] ?? `Mes ${mes}`;

  // ── Port status ──────────────────────────────────────────────────────────
  const PORT_STATUS_LABEL: Record<string, string> = {
    OPEN:               "ABIERTO",
    PARTIALLY_OPEN:     "PARCIALMENTE ABIERTO",
    CLOSED_WEATHER:     "CERRADO POR CLIMA",
    CLOSED_MAINTENANCE: "CERRADO POR MANTENIMIENTO",
    CLOSED_SECURITY:    "CERRADO POR SEGURIDAD",
    CLOSED_OTHER:       "CERRADO",
  };
  let portSection = "Sin información del estado del puerto.";
  if (portStatus) {
    portSection = `Puerto: ${portStatus.branch.name} | Estado: ${PORT_STATUS_LABEL[portStatus.status] ?? portStatus.status}`;
    if (portStatus.message) portSection += ` | Mensaje: "${portStatus.message}"`;
    if (portStatus.estimatedReopeningAt) {
      portSection += ` | Reapertura estimada: ${toArgDate(portStatus.estimatedReopeningAt)}`;
    }
  }

  // ── Today / tomorrow trips ───────────────────────────────────────────────
  const fmtViaje = (v: ViajeProximo): string => {
    let line = `- ${v.hora} hs | ${v.boatName}`;
    if (v.driverName) line += ` | Chofer: ${v.driverName}`;
    if (v.ruta !== "Ruta no especificada") line += ` | Ruta: ${v.ruta}`;
    line += ` | ${v.confirmados}/${v.capacidad} pasajeros | Estado: ${v.status}`;
    if (v.porDepto.length > 0) {
      line += `\n  Por depto: ${v.porDepto.map((d) => `${d.nombre} ×${d.count}`).join(", ")}`;
    }
    return line;
  };

  const today      = toArgDate(new Date());
  const viajesHoy  = proximos.hoy.length > 0
    ? proximos.hoy.map(fmtViaje).join("\n")
    : "- Sin viajes programados para hoy";
  const viajesMan  = proximos.manana.length > 0
    ? proximos.manana.map(fmtViaje).join("\n")
    : "- Sin viajes programados para mañana";

  // ── Last 7 days ──────────────────────────────────────────────────────────
  const viajes7Section = viajes7.length > 0
    ? viajes7
        .map((v) => `- ${v.fecha} ${v.hora} | ${v.boatName} | ${v.confirmados}/${v.capacidad} (${v.pct}) | ${v.status}`)
        .join("\n")
    : "- Sin viajes en los últimos 7 días";

  // ── Choferes ──────────────────────────────────────────────────────────────
  const choferesSection = choferes.length > 0
    ? choferes
        .map((c) => `- ${c.firstName} ${c.lastName}${c.licenseNumber ? ` (Lic: ${c.licenseNumber})` : ""}`)
        .join("\n")
    : "- Sin choferes activos registrados";

  // ── Empleadores ───────────────────────────────────────────────────────────
  const empleadoresSection = empleadores.length > 0
    ? empleadores
        .map((e) => `- ${e.name}${e.taxId ? ` (CUIT: ${e.taxId})` : ""}`)
        .join("\n")
    : "- Sin empresas registradas";

  // ── Department totals (from metrics, show all) ───────────────────────────
  const allDeptos = metrics.resumenPorDepto
    .sort((a, b) => b.asientosConfirmados - a.asientosConfirmados)
    .map(
      (d) =>
        `- ${d.departamentoNombre}: ${d.asientosConfirmados} confirmados, ${d.asientosPendientes} pendientes` +
        (d.liquidado ? ` (liquidado: ${d.totalAsientosLiq.toFixed(1)} asientos)` : " (sin liquidar)"),
    )
    .join("\n");

  // ── Efficiency signals ────────────────────────────────────────────────────
  const lanchasBajas = eficiencia.lanchasBajaOcupacion.length === 0
    ? "- Ninguna con baja ocupación"
    : eficiencia.lanchasBajaOcupacion
        .map((l) => `- ${l.boatName}: ${(l.promedioOcupacion * 100).toFixed(1)}% en ${l.viajesCount} viajes`)
        .join("\n");

  const deptosSolos = eficiencia.deptosSolosFrecuentes.length === 0
    ? "- Ninguno"
    : eficiencia.deptosSolosFrecuentes
        .map((d) => `- ${d.departamentoNombre}: viajó solo ${d.vecesViajaSolo} veces`)
        .join("\n");

  const horarios = eficiencia.horariosAltaDemanda
    .map((h) => `- ${h.hora}:00 hs: ${h.totalAsientos} asientos en ${h.totalViajes} viajes`)
    .join("\n") || "- Sin datos";

  return `
PERÍODO ANALIZADO: ${mesNombre} ${anio}

ESTADO ACTUAL DEL PUERTO:
${portSection}

VIAJES DE HOY (${today}):
${viajesHoy}

VIAJES DE MAÑANA:
${viajesMan}

VIAJES ÚLTIMOS 7 DÍAS (más recientes primero):
${viajes7Section}

CHOFERES / CONDUCTORES ACTIVOS:
${choferesSection}

EMPRESAS / EMPLEADORES REGISTRADOS:
${empleadoresSection}

RESUMEN GENERAL DEL PERÍODO (${mesNombre} ${anio}):
- Total viajes: ${metrics.totalViajesDelPeriodo}
- Ocupación promedio: ${(metrics.promedioOcupacion * 100).toFixed(1)}%
- Viajes sin liquidar: ${metrics.viajesSinLiquidar}

DEPARTAMENTOS — ACTIVIDAD DEL PERÍODO:
${allDeptos || "- Sin datos"}

LANCHAS CON BAJA OCUPACIÓN (< 60% promedio):
${lanchasBajas}

DEPARTAMENTOS QUE FRECUENTEMENTE VIAJAN SOLOS:
${deptosSolos}

HORARIOS DE ALTA DEMANDA (top 5 por asientos):
${horarios}
`.trim();
}

// ---------------------------------------------------------------------------
// POST handler
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

  const parsed = BodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Datos de solicitud inválidos." } },
      { status: 400 },
    );
  }

  const { pregunta, mes, anio } = parsed.data;
  const { companyId, userId } = guard;

  const rateCheck = checkRateLimit(userId);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: `Límite de requests alcanzado. Intentá en ${rateCheck.minutesLeft} minuto${rateCheck.minutesLeft !== 1 ? "s" : ""}.` } },
      { status: 429 },
    );
  }

  // Gather all operational context in parallel
  const [metrics, eficiencia, proximos, viajes7, choferes, empleadores, portStatus] =
    await Promise.all([
      getAdminMetrics(companyId, mes, anio),
      getEficienciaMetrics(companyId, mes, anio),
      getViajesProximos(companyId),
      getUltimos7Dias(companyId),
      getChoferesActivos(companyId),
      getEmpleadoresActivos(companyId),
      getPortStatusActual(companyId),
    ]);

  const context = buildContext(
    metrics, eficiencia, proximos, viajes7, choferes, empleadores, portStatus, mes, anio,
  );

  // Call Claude API
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let respuesta: string;
  try {
    const message = await anthropic.messages.create({
      model:      "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system:
        "Sos el UABL Assistant, asistente de eficiencia operativa del sistema HarborFlow " +
        "para UABL Puerto Rosario Argentina. " +
        "Respondé en español, de forma concisa y directa. Podés usar markdown básico " +
        "(negritas, listas) para estructurar tu respuesta. " +
        "Usás los datos reales que te paso como contexto. " +
        "Nunca inventés datos. Si no tenés información suficiente para responder algo, " +
        "decilo claramente.",
      messages: [
        {
          role:    "user",
          content: `Contexto operativo real:\n${context}\n\nPregunta: ${pregunta}`,
        },
      ],
    });

    respuesta =
      message.content[0]?.type === "text"
        ? message.content[0].text
        : "No pude generar una respuesta. Intentá de nuevo.";
  } catch (err) {
    console.error("[POST /api/uabl/assistant] Claude error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Error al consultar la IA. Verificá la API key o intentá más tarde." } },
      { status: 500 },
    );
  }

  return NextResponse.json({ respuesta });
}
