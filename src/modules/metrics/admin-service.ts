// =============================================================================
// Admin Metrics Service
// =============================================================================
//
// Computes decision-grade metrics for the admin dashboard.
//
// Data sources:
//   - Trip (total trips, occupancy base)
//   - PassengerSlot (actual seat usage per department)
//   - AsientoLiquidacion (formal liquidated seat allocation)
//   - Department (names for display)
//   - Boat (for per-vessel efficiency metrics)
//
// Period semantics: "mes" and "anio" refer to Argentina calendar month (UTC-3).
// All DB timestamps are UTC; we adjust the date range accordingly.
//
// =============================================================================

import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** UTC timestamp range covering a full Argentina calendar month. */
function periodRange(mes: number, anio: number): { from: Date; to: Date } {
  // Argentina is UTC-3 (no DST).
  // Month start: 00:00 ART = 03:00 UTC on the 1st.
  // Month end:   23:59:59.999 ART on last day = 02:59:59.999 UTC on 1st of next month.
  return {
    from: new Date(Date.UTC(anio, mes - 1, 1, 3, 0, 0, 0)),
    to:   new Date(Date.UTC(anio, mes,     1, 2, 59, 59, 999)),
  };
}

/** Argentina calendar date string (YYYY-MM-DD) for a UTC Date. */
function toArgDateStr(date: Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(date);
}

/** Departure hour (0-23) in Argentina timezone. */
function argHour(date: Date): number {
  // UTC-3 offset: subtract 3 hours then read UTC hour.
  return new Date(date.getTime() - 3 * 60 * 60 * 1000).getUTCHours();
}

// ---------------------------------------------------------------------------
// Types — main metrics
// ---------------------------------------------------------------------------

export type DeptoResumen = {
  departamentoId:      string;
  departamentoNombre:  string;
  /** Active seats (CONFIRMED) from PassengerSlot in the period. */
  asientosConfirmados: number;
  /** Tentative seats (PENDING) from PassengerSlot in the period. */
  asientosPendientes:  number;
  /** Formally liquidated seat-equivalents (from AsientoLiquidacion). 0 if not yet liquidated. */
  totalAsientosLiq:    number;
  /** How many trips in this period have a liquidation record for this dept. */
  viajesLiquidados:    number;
  /** True if at least one AsientoLiquidacion record exists for this dept+period. */
  liquidado:           boolean;
};

export type OcupacionDia = {
  /** YYYY-MM-DD in Argentina timezone. */
  fecha:         string;
  /** Average occupancy rate (0.0–1.0) across all trips departing that day. */
  ocupacion:     number;
  /** Total occupied seats (PENDING + CONFIRMED) that day. */
  totalAsientos: number;
};

export type AdminMetrics = {
  resumenPorDepto:       DeptoResumen[];
  totalViajesDelPeriodo: number;
  /** Simple mean of per-trip (slotsOccupied / capacity) across the period. */
  promedioOcupacion:     number;
  /** Trips with viajeStatus = PASADO and liquidacionCalculada = false. */
  viajesSinLiquidar:     number;
  /** Per-day occupancy for the line chart. */
  ocupacionPorDia:       OcupacionDia[];
};

// ---------------------------------------------------------------------------
// Types — efficiency metrics
// ---------------------------------------------------------------------------

export type LanchaOcupacion = {
  boatId:              string;
  boatName:            string;
  promedioOcupacion:   number;
  viajesCount:         number;
};

export type DeptoSolo = {
  departamentoId:     string;
  departamentoNombre: string;
  /** Number of trips where this was the only department with seats. */
  vecesViajaSolo:     number;
};

export type HorarioDemanda = {
  /** Departure hour 0-23 (Argentina timezone). */
  hora:          number;
  totalAsientos: number;
  totalViajes:   number;
};

export type EficienciaMetrics = {
  /** Boats with average occupancy below 60% in the period. */
  lanchasBajaOcupacion:   LanchaOcupacion[];
  /** Departments that were the only occupant on a trip ≥ 2 times. */
  deptosSolosFrecuentes:  DeptoSolo[];
  /** Top-5 hours by total seats booked across all trips in the period. */
  horariosAltaDemanda:    HorarioDemanda[];
};

// ---------------------------------------------------------------------------
// getAdminMetrics
// ---------------------------------------------------------------------------

export async function getAdminMetrics(
  companyId:       string,
  mes:             number,
  anio:            number,
  departamentoId?: string,
): Promise<AdminMetrics> {
  const { from, to } = periodRange(mes, anio);

  // ── 1. Trips in the period ───────────────────────────────────────────────
  const trips = await prisma.trip.findMany({
    where: { companyId, departureTime: { gte: from, lte: to } },
    select: {
      id:                   true,
      capacity:             true,
      departureTime:        true,
      viajeStatus:          true,
      liquidacionCalculada: true,
    },
    orderBy: { departureTime: "asc" },
  });

  const tripIds = trips.map((t) => t.id);
  const totalViajesDelPeriodo = trips.length;
  const viajesSinLiquidar = trips.filter(
    (t) => t.viajeStatus === "PASADO" && !t.liquidacionCalculada,
  ).length;

  // ── 2. Slot counts per trip for occupancy computation ────────────────────
  const slotCountsByTrip = new Map<string, number>();

  if (tripIds.length > 0) {
    const slotGroups = await prisma.passengerSlot.groupBy({
      by:    ["tripId"],
      where: {
        companyId,
        tripId: { in: tripIds },
        status: { in: ["PENDING", "CONFIRMED"] },
      },
      _count: { id: true },
    });
    for (const g of slotGroups) slotCountsByTrip.set(g.tripId, g._count.id);
  }

  // ── 3. Occupancy aggregates ──────────────────────────────────────────────
  let occupancySum   = 0;
  let occupancyCount = 0;
  const dayMap = new Map<string, { occupied: number; capacity: number }>();

  for (const trip of trips) {
    const occupied = slotCountsByTrip.get(trip.id) ?? 0;
    if (trip.capacity > 0) {
      occupancySum   += occupied / trip.capacity;
      occupancyCount += 1;
    }
    const dateKey = toArgDateStr(trip.departureTime);
    const day = dayMap.get(dateKey) ?? { occupied: 0, capacity: 0 };
    day.occupied += occupied;
    day.capacity += trip.capacity;
    dayMap.set(dateKey, day);
  }

  const promedioOcupacion = occupancyCount > 0 ? occupancySum / occupancyCount : 0;

  const ocupacionPorDia: OcupacionDia[] = Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, d]) => ({
      fecha,
      ocupacion:     d.capacity > 0 ? d.occupied / d.capacity : 0,
      totalAsientos: d.occupied,
    }));

  // ── 4. Slot counts per department ────────────────────────────────────────
  const slotSummaryByDept = new Map<string, { confirmed: number; pending: number }>();

  if (tripIds.length > 0) {
    const slotsByDeptStatus = await prisma.passengerSlot.groupBy({
      by:    ["departmentId", "status"],
      where: {
        companyId,
        tripId: { in: tripIds },
        status: { in: ["PENDING", "CONFIRMED"] },
        ...(departamentoId ? { departmentId: departamentoId } : {}),
      },
      _count: { id: true },
    });

    for (const row of slotsByDeptStatus) {
      const s = slotSummaryByDept.get(row.departmentId) ?? { confirmed: 0, pending: 0 };
      if (row.status === "CONFIRMED") s.confirmed = row._count.id;
      if (row.status === "PENDING")   s.pending   = row._count.id;
      slotSummaryByDept.set(row.departmentId, s);
    }
  }

  // ── 5. Liquidation records for the period ────────────────────────────────
  const liqRecords = await prisma.asientoLiquidacion.findMany({
    where: {
      companyId,
      anio,
      mes,
      ...(departamentoId ? { departamentoId } : {}),
    },
    select: {
      departamentoId: true,
      totalAsientos:  true,
      viajeId:        true,
    },
  });

  const liqByDept = new Map<string, { totalAsientos: number; trips: Set<string> }>();
  for (const liq of liqRecords) {
    const l = liqByDept.get(liq.departamentoId) ?? { totalAsientos: 0, trips: new Set() };
    l.totalAsientos += Number(liq.totalAsientos);
    l.trips.add(liq.viajeId);
    liqByDept.set(liq.departamentoId, l);
  }

  // ── 6. Merge into resumenPorDepto ────────────────────────────────────────
  // Departments to show: those with slot activity OR liquidation records.
  // When dept filter active, show only that one (even if zeros).
  const activeDeptIds = new Set([
    ...slotSummaryByDept.keys(),
    ...liqByDept.keys(),
  ]);

  const deptWhere = departamentoId
    ? { id: departamentoId, companyId }
    : { companyId, id: { in: Array.from(activeDeptIds) }, isActive: true };

  const departments = await prisma.department.findMany({
    where:   deptWhere,
    select:  { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const resumenPorDepto: DeptoResumen[] = departments.map((dept) => {
    const slots = slotSummaryByDept.get(dept.id);
    const liq   = liqByDept.get(dept.id);
    return {
      departamentoId:      dept.id,
      departamentoNombre:  dept.name,
      asientosConfirmados: slots?.confirmed ?? 0,
      asientosPendientes:  slots?.pending   ?? 0,
      totalAsientosLiq:    liq ? parseFloat(liq.totalAsientos.toFixed(4)) : 0,
      viajesLiquidados:    liq?.trips.size  ?? 0,
      liquidado:           !!liq,
    };
  });

  return {
    resumenPorDepto,
    totalViajesDelPeriodo,
    promedioOcupacion,
    viajesSinLiquidar,
    ocupacionPorDia,
  };
}

// ---------------------------------------------------------------------------
// getEficienciaMetrics
// ---------------------------------------------------------------------------

export async function getEficienciaMetrics(
  companyId: string,
  mes:       number,
  anio:      number,
): Promise<EficienciaMetrics> {
  const { from, to } = periodRange(mes, anio);

  // ── 1. Trips with boat info ──────────────────────────────────────────────
  const trips = await prisma.trip.findMany({
    where:  { companyId, departureTime: { gte: from, lte: to } },
    select: {
      id:            true,
      capacity:      true,
      departureTime: true,
      boat:          { select: { id: true, name: true } },
    },
    orderBy: { departureTime: "asc" },
  });

  const tripIds = trips.map((t) => t.id);
  if (tripIds.length === 0) {
    return {
      lanchasBajaOcupacion:  [],
      deptosSolosFrecuentes: [],
      horariosAltaDemanda:   [],
    };
  }

  // ── 2. Slot counts by (tripId, departmentId) ─────────────────────────────
  const slotsByTripDept = await prisma.passengerSlot.groupBy({
    by:    ["tripId", "departmentId"],
    where: {
      companyId,
      tripId: { in: tripIds },
      status: { in: ["PENDING", "CONFIRMED"] },
    },
    _count: { id: true },
  });

  // Map tripId → total occupied
  const occupiedByTrip = new Map<string, number>();
  // Map tripId → Set<departmentId>
  const deptsByTrip = new Map<string, Set<string>>();

  for (const row of slotsByTripDept) {
    occupiedByTrip.set(row.tripId, (occupiedByTrip.get(row.tripId) ?? 0) + row._count.id);
    const depts = deptsByTrip.get(row.tripId) ?? new Set();
    depts.add(row.departmentId);
    deptsByTrip.set(row.tripId, depts);
  }

  // ── 3. Lanchas con baja ocupación (< 60% promedio) ───────────────────────
  const boatMap = new Map<string, { name: string; occupancySum: number; count: number }>();

  for (const trip of trips) {
    const occupied = occupiedByTrip.get(trip.id) ?? 0;
    const ratio    = trip.capacity > 0 ? occupied / trip.capacity : 0;
    const b = boatMap.get(trip.boat.id) ?? { name: trip.boat.name, occupancySum: 0, count: 0 };
    b.occupancySum += ratio;
    b.count        += 1;
    boatMap.set(trip.boat.id, b);
  }

  const lanchasBajaOcupacion: LanchaOcupacion[] = Array.from(boatMap.entries())
    .map(([boatId, b]) => ({
      boatId,
      boatName:           b.name,
      promedioOcupacion:  b.count > 0 ? b.occupancySum / b.count : 0,
      viajesCount:        b.count,
    }))
    .filter((b) => b.promedioOcupacion < 0.6)
    .sort((a, b) => a.promedioOcupacion - b.promedioOcupacion);

  // ── 4. Deptos que viajan solos frecuentemente (≥ 2 veces) ────────────────
  const soloCountByDept = new Map<string, number>();
  for (const [, depts] of deptsByTrip) {
    if (depts.size === 1) {
      const deptId = Array.from(depts)[0];
      if (deptId) {
        soloCountByDept.set(deptId, (soloCountByDept.get(deptId) ?? 0) + 1);
      }
    }
  }

  const soloDeptoIds = Array.from(soloCountByDept.keys()).filter(
    (id) => (soloCountByDept.get(id) ?? 0) >= 2,
  );

  let deptosSolosFrecuentes: DeptoSolo[] = [];
  if (soloDeptoIds.length > 0) {
    const depts = await prisma.department.findMany({
      where:   { id: { in: soloDeptoIds } },
      select:  { id: true, name: true },
    });
    deptosSolosFrecuentes = depts
      .map((d) => ({
        departamentoId:     d.id,
        departamentoNombre: d.name,
        vecesViajaSolo:     soloCountByDept.get(d.id) ?? 0,
      }))
      .sort((a, b) => b.vecesViajaSolo - a.vecesViajaSolo);
  }

  // ── 5. Horarios de alta demanda ──────────────────────────────────────────
  const hourMap = new Map<number, { totalAsientos: number; totalViajes: number }>();
  for (const trip of trips) {
    const hora     = argHour(trip.departureTime);
    const occupied = occupiedByTrip.get(trip.id) ?? 0;
    const h = hourMap.get(hora) ?? { totalAsientos: 0, totalViajes: 0 };
    h.totalAsientos += occupied;
    h.totalViajes   += 1;
    hourMap.set(hora, h);
  }

  const horariosAltaDemanda: HorarioDemanda[] = Array.from(hourMap.entries())
    .map(([hora, h]) => ({ hora, ...h }))
    .sort((a, b) => b.totalAsientos - a.totalAsientos)
    .slice(0, 5);

  return {
    lanchasBajaOcupacion,
    deptosSolosFrecuentes,
    horariosAltaDemanda,
  };
}
