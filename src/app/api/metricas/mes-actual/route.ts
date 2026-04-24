// GET /api/metricas/mes-actual
//
// Calcula métricas del mes en curso en tiempo real (sin snapshot).
// Período: desde el día 1 del mes actual hasta now(), en timezone Argentina (UTC-3).
//
// Incluye comparativa vs el mismo período del mes anterior
// (mismos cálculos pero para días 1 a N del mes previo, N = día actual).
//
// Auth: UABL only.
// Response: { data: MesActualData }

import { NextResponse } from "next/server";
import { auth }        from "@/lib/auth";
import { AppError }    from "@/lib/errors";
import { assertRole }  from "@/lib/permissions";
import { prisma }      from "@/lib/prisma";

// Argentina is UTC-3, no DST.
const ARG_OFFSET_MS = 3 * 60 * 60 * 1000;

function getArgParts() {
  // Represent Argentina "now" as a UTC date shifted by -3h
  const arg = new Date(Date.now() - ARG_OFFSET_MS);
  return {
    day:   arg.getUTCDate(),
    month: arg.getUTCMonth() + 1,
    year:  arg.getUTCFullYear(),
  };
}

// Argentina midnight of (year, month, day=1) expressed as UTC timestamp.
// Midnight ART = 03:00 UTC.
function argMidnightUtc(year: number, month: number, day = 1): Date {
  return new Date(Date.UTC(year, month - 1, day, 3, 0, 0));
}

function calcOcupacion(
  trips: Array<{ capacity: number; _count: { passengerSlots: number } }>,
): number {
  if (trips.length === 0) return 0;
  return (
    trips.reduce(
      (sum, t) => sum + (t.capacity > 0 ? t._count.passengerSlots / t.capacity : 0),
      0,
    ) / trips.length
  );
}

export async function GET(): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "No autorizado." } },
        { status: 401 },
      );
    }

    assertRole(session.user.role, ["UABL"]);

    const { companyId } = session.user;
    const { day, month, year } = getArgParts();

    // ── Current month UTC bounds ────────────────────────────────────────────
    const mesStart = argMidnightUtc(year, month, 1);
    const realNow  = new Date();
    const diasEnMes = new Date(Date.UTC(year, month, 0)).getUTCDate();

    // ── Previous month same-period UTC bounds ───────────────────────────────
    const prevMonth   = month === 1 ? 12 : month - 1;
    const prevYear    = month === 1 ? year - 1 : year;
    const prevLastDay = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate();
    const prevDay     = Math.min(day, prevLastDay);

    const prevStart = argMidnightUtc(prevYear, prevMonth, 1);
    // Upper bound: start of (prevDay + 1) in ART = exclusive end
    const prevEnd   = argMidnightUtc(prevYear, prevMonth, prevDay + 1);

    // ── Run all queries in parallel ─────────────────────────────────────────
    const [
      viajesRealizados,
      viajesProgramados,
      viajesCancelados,
      pastTrips,
      currentSlots,
      prevViajesRealizados,
      prevPastTrips,
      prevTotalPasajeros,
      departamentos,
    ] = await Promise.all([
      // Viajes completados/pasados este mes
      prisma.trip.count({
        where: { companyId, viajeStatus: "PASADO", departureTime: { gte: mesStart, lte: realNow } },
      }),
      // Viajes activos con salida futura (programados restantes)
      prisma.trip.count({
        where: { companyId, viajeStatus: "ACTIVO", departureTime: { gte: realNow } },
      }),
      // Viajes cancelados este mes
      prisma.trip.count({
        where: { companyId, viajeStatus: "CANCELADO", departureTime: { gte: mesStart, lte: realNow } },
      }),
      // Viajes pasados con slot counts para calcular ocupación
      prisma.trip.findMany({
        where: { companyId, viajeStatus: "PASADO", departureTime: { gte: mesStart, lte: realNow } },
        select: {
          capacity: true,
          _count: {
            select: {
              passengerSlots: { where: { status: { in: ["CONFIRMED", "PENDING"] } } },
            },
          },
        },
      }),
      // Slots CONFIRMED en viajes pasados este mes (distribución + total pasajeros)
      prisma.passengerSlot.findMany({
        where: {
          companyId,
          status: "CONFIRMED",
          trip: { viajeStatus: "PASADO", departureTime: { gte: mesStart, lte: realNow } },
        },
        select: { departmentId: true },
      }),
      // ── Comparativa mes anterior ──
      prisma.trip.count({
        where: { companyId, viajeStatus: "PASADO", departureTime: { gte: prevStart, lt: prevEnd } },
      }),
      prisma.trip.findMany({
        where: { companyId, viajeStatus: "PASADO", departureTime: { gte: prevStart, lt: prevEnd } },
        select: {
          capacity: true,
          _count: {
            select: {
              passengerSlots: { where: { status: { in: ["CONFIRMED", "PENDING"] } } },
            },
          },
        },
      }),
      prisma.passengerSlot.count({
        where: {
          companyId,
          status: "CONFIRMED",
          trip: { viajeStatus: "PASADO", departureTime: { gte: prevStart, lt: prevEnd } },
        },
      }),
      // Nombre de departamentos para la distribución
      prisma.department.findMany({
        where: { companyId },
        select: { id: true, name: true },
      }),
    ]);

    // ── Ocupación promedio ──────────────────────────────────────────────────
    const promedioOcupacion     = calcOcupacion(pastTrips);
    const prevPromedioOcupacion = calcOcupacion(prevPastTrips);

    // ── Distribución por departamento (top 5) ───────────────────────────────
    const deptMap = Object.fromEntries(departamentos.map((d) => [d.id, d.name]));
    const deptCounts: Record<string, number> = {};
    for (const slot of currentSlots) {
      deptCounts[slot.departmentId] = (deptCounts[slot.departmentId] ?? 0) + 1;
    }
    const distribucion = Object.entries(deptCounts)
      .map(([id, asientos]) => ({ nombre: deptMap[id] ?? id, asientos }))
      .sort((a, b) => b.asientos - a.asientos)
      .slice(0, 5);

    return NextResponse.json({
      data: {
        mes:               month,
        anio:              year,
        diaActual:         day,
        diasEnMes,
        viajesRealizados,
        viajesProgramados,
        viajesCancelados,
        promedioOcupacion,
        totalPasajeros:    currentSlots.length,
        distribucion,
        comparativa: {
          viajesRealizados:  prevViajesRealizados,
          promedioOcupacion: prevPromedioOcupacion,
          totalPasajeros:    prevTotalPasajeros,
        },
      },
    });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: err.statusCode },
      );
    }
    console.error("[GET /api/metricas/mes-actual]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Error interno." } },
      { status: 500 },
    );
  }
}
