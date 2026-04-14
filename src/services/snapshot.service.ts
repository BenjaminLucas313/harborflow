// =============================================================================
// Snapshot Service
// =============================================================================
//
// Generates and retrieves SnapshotMensual records — immutable monthly aggregates
// used for period comparison and AI analysis.
//
// Design notes:
//   - generarSnapshotMensual is idempotent via upsert: safe to call multiple times.
//   - All date math uses Argentina timezone (UTC-3, no DST).
//   - Cancelled trips (viajeStatus = CANCELADO) are excluded from occupancy
//     calculations but counted separately in `cancelaciones`.
//   - Occupancy ratio is stored as 0.0–1.0 (not a percentage).
//   - promedioOcupacion = mean of per-trip (occupied / capacity) ratios.
// =============================================================================

import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Internal helpers (Argentina timezone, UTC-3)
// ---------------------------------------------------------------------------

function periodRange(mes: number, anio: number): { from: Date; to: Date } {
  return {
    from: new Date(Date.UTC(anio, mes - 1, 1, 3, 0, 0, 0)),
    to:   new Date(Date.UTC(anio, mes,     1, 2, 59, 59, 999)),
  };
}

function toArgDateStr(date: Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(date);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ViajesPorDiaEntry = { viajes: number; ocupacion: number };

export type SnapshotConVariacion = {
  id:                    string;
  companyId:             string;
  branchId:              string | null;
  mes:                   number;
  anio:                  number;
  totalViajes:           number;
  totalAsientosOcupados: number;
  totalAsientosVacios:   number;
  promedioOcupacion:     number;
  distribucionDeptos:    Record<string, number>;
  viajesPorDia:          Record<string, ViajesPorDiaEntry>;
  cancelaciones:         number;
  viajesBajaOcupacion:   number;
  generadoEn:            Date;
  cerrado:               boolean;
  /** % change vs previous period. undefined for the oldest snapshot returned. */
  variacionOcupacion?:      number;
  variacionViajes?:         number;
  variacionCancelaciones?:  number;
};

// ---------------------------------------------------------------------------
// generarSnapshotMensual
// ---------------------------------------------------------------------------

export async function generarSnapshotMensual(
  companyId: string,
  mes:       number,
  anio:      number,
) {
  const { from, to } = periodRange(mes, anio);

  // ── 1. All trips in the period ───────────────────────────────────────────
  const trips = await prisma.trip.findMany({
    where:   { companyId, departureTime: { gte: from, lte: to } },
    select:  { id: true, capacity: true, departureTime: true, viajeStatus: true },
    orderBy: { departureTime: "asc" },
  });

  const totalViajes    = trips.length;
  const cancelaciones  = trips.filter((t) => t.viajeStatus === "CANCELADO").length;
  const activeTrips    = trips.filter((t) => t.viajeStatus !== "CANCELADO");
  const activeTripIds  = activeTrips.map((t) => t.id);

  // ── 2. Slot counts per active trip ───────────────────────────────────────
  const slotCountsByTrip = new Map<string, number>();

  if (activeTripIds.length > 0) {
    const slotGroups = await prisma.passengerSlot.groupBy({
      by:    ["tripId"],
      where: {
        companyId,
        tripId: { in: activeTripIds },
        status: { in: ["PENDING", "CONFIRMED"] },
      },
      _count: { id: true },
    });
    for (const g of slotGroups) slotCountsByTrip.set(g.tripId, g._count.id);
  }

  // ── 3. Occupancy aggregates ──────────────────────────────────────────────
  let occupancySum        = 0;
  let occupancyCount      = 0;
  let totalAsientosOcupados = 0;
  let totalCapacity       = 0;
  let viajesBajaOcupacion = 0;

  const dayMap = new Map<string, { viajes: number; occupancySum: number; occupancyCount: number }>();

  for (const trip of activeTrips) {
    const occupied = slotCountsByTrip.get(trip.id) ?? 0;
    totalAsientosOcupados += occupied;
    totalCapacity         += trip.capacity;

    if (trip.capacity > 0) {
      const ratio = occupied / trip.capacity;
      occupancySum   += ratio;
      occupancyCount += 1;
      if (ratio < 0.40) viajesBajaOcupacion++;
    }

    const dateKey = toArgDateStr(trip.departureTime);
    const day = dayMap.get(dateKey) ?? { viajes: 0, occupancySum: 0, occupancyCount: 0 };
    day.viajes += 1;
    if (trip.capacity > 0) {
      day.occupancySum   += trip.capacity > 0 ? (slotCountsByTrip.get(trip.id) ?? 0) / trip.capacity : 0;
      day.occupancyCount += 1;
    }
    dayMap.set(dateKey, day);
  }

  const promedioOcupacion  = occupancyCount > 0 ? occupancySum / occupancyCount : 0;
  const totalAsientosVacios = totalCapacity - totalAsientosOcupados;

  // ── 4. viajesPorDia ──────────────────────────────────────────────────────
  const viajesPorDia: Record<string, ViajesPorDiaEntry> = {};
  for (const [fecha, d] of dayMap.entries()) {
    viajesPorDia[fecha] = {
      viajes:    d.viajes,
      ocupacion: d.occupancyCount > 0
        ? parseFloat((d.occupancySum / d.occupancyCount).toFixed(4))
        : 0,
    };
  }

  // ── 5. distribucionDeptos: { [deptName]: totalSlots } ────────────────────
  const distribucionDeptos: Record<string, number> = {};

  if (activeTripIds.length > 0) {
    const slotsByDept = await prisma.passengerSlot.groupBy({
      by:    ["departmentId"],
      where: {
        companyId,
        tripId: { in: activeTripIds },
        status: { in: ["PENDING", "CONFIRMED"] },
      },
      _count: { id: true },
    });

    if (slotsByDept.length > 0) {
      const deptIds = slotsByDept.map((s) => s.departmentId);
      const depts   = await prisma.department.findMany({
        where:  { id: { in: deptIds } },
        select: { id: true, name: true },
      });
      const nameById = new Map(depts.map((d) => [d.id, d.name]));

      for (const row of slotsByDept) {
        const name = nameById.get(row.departmentId) ?? row.departmentId;
        distribucionDeptos[name] = (distribucionDeptos[name] ?? 0) + row._count.id;
      }
    }
  }

  // ── 6. Upsert (idempotent) ───────────────────────────────────────────────
  const snapshot = await prisma.snapshotMensual.upsert({
    where:  { companyId_mes_anio: { companyId, mes, anio } },
    create: {
      companyId,
      mes,
      anio,
      totalViajes,
      totalAsientosOcupados,
      totalAsientosVacios,
      promedioOcupacion:    parseFloat(promedioOcupacion.toFixed(4)),
      distribucionDeptos,
      viajesPorDia,
      cancelaciones,
      viajesBajaOcupacion,
    },
    update: {
      totalViajes,
      totalAsientosOcupados,
      totalAsientosVacios,
      promedioOcupacion:    parseFloat(promedioOcupacion.toFixed(4)),
      distribucionDeptos,
      viajesPorDia,
      cancelaciones,
      viajesBajaOcupacion,
      generadoEn:           new Date(),
    },
  });

  return snapshot;
}

// ---------------------------------------------------------------------------
// getSnapshotComparativo
// ---------------------------------------------------------------------------

export async function getSnapshotComparativo(
  companyId: string,
  meses:     number,
): Promise<SnapshotConVariacion[]> {
  // Fetch one extra to compute the variation for the oldest shown period.
  const rows = await prisma.snapshotMensual.findMany({
    where:   { companyId },
    orderBy: [{ anio: "desc" }, { mes: "desc" }],
    take:    meses + 1,
  });

  function pct(curr: number, prev: number): number | undefined {
    return prev !== 0
      ? parseFloat(((curr - prev) / Math.abs(prev) * 100).toFixed(2))
      : undefined;
  }

  const result: SnapshotConVariacion[] = [];

  for (let i = 0; i < Math.min(rows.length, meses); i++) {
    const cur  = rows[i]!;
    const prev = rows[i + 1];

    const curOcup   = parseFloat(cur.promedioOcupacion.toString());
    const prevOcup  = prev ? parseFloat(prev.promedioOcupacion.toString()) : undefined;

    result.push({
      id:                    cur.id,
      companyId:             cur.companyId,
      branchId:              cur.branchId,
      mes:                   cur.mes,
      anio:                  cur.anio,
      totalViajes:           cur.totalViajes,
      totalAsientosOcupados: parseFloat(cur.totalAsientosOcupados.toString()),
      totalAsientosVacios:   parseFloat(cur.totalAsientosVacios.toString()),
      promedioOcupacion:     curOcup,
      distribucionDeptos:    cur.distribucionDeptos as Record<string, number>,
      viajesPorDia:          cur.viajesPorDia as Record<string, ViajesPorDiaEntry>,
      cancelaciones:         cur.cancelaciones,
      viajesBajaOcupacion:   cur.viajesBajaOcupacion,
      generadoEn:            cur.generadoEn,
      cerrado:               cur.cerrado,
      variacionOcupacion:    prev ? pct(curOcup, prevOcup!) : undefined,
      variacionViajes:       prev ? pct(cur.totalViajes, prev.totalViajes) : undefined,
      variacionCancelaciones: prev ? pct(cur.cancelaciones, prev.cancelaciones) : undefined,
    });
  }

  return result;
}
