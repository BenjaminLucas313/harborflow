// =============================================================================
// Liquidacion Service
// =============================================================================
//
// Handles the end-of-month seat settlement for UABL department trips.
//
// BUSINESS RULE
// -------------
// After a trip is completed (viajeStatus = PASADO), vacant seats are
// distributed EQUALLY among every department that had at least one
// reservation on that trip:
//
//   fraccionVacios[dept] = totalVacios / cantidadDeptosUnicos
//   totalAsientos[dept]  = asientosReservados[dept] + fraccionVacios[dept]
//
// Example (capacity=10, occupied=6: Mant×3, Limp×2, Serv×1 → 4 vacant, 3 depts):
//   fraccionVacios = 4 / 3 = 1.3333
//   Mant: total = 3 + 1.3333 = 4.3333
//   Limp: total = 2 + 1.3333 = 3.3333
//   Serv: total = 1 + 1.3333 = 2.3333
//
// SEAT SOURCE
// -----------
// Active reservations = Reservation records with:
//   status IN (CONFIRMED, CHECKED_IN) AND departamentoId IS NOT NULL
//
// This covers the UABL internal department booking flow (V1 Reservation model
// with departamentoId). The V2 PassengerSlot path (EMPRESA external bookings)
// does not participate in internal department liquidation.
//
// IDEMPOTENCY
// -----------
// If liquidacionCalculada = true, calcularDistribucionViaje returns the
// existing cached records without recalculating.
// AsientoLiquidacion records use @@unique([viajeId, departamentoId]) so
// a duplicate upsert is always safe.
//
// DECIMAL PRECISION
// -----------------
// All fractional values use Prisma.Decimal (backed by decimal.js) with
// 4 decimal places. Rounding: ROUND_HALF_UP (standard accounting).
// The sum of all totalAsientos may differ from capacity by up to
//   0.00005 × cantidadDeptos (rounding noise — acceptable).
//
// =============================================================================

import { Prisma, ReservationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { logAction } from "@/modules/audit/repository";

// =============================================================================
// Types
// =============================================================================

export type DistribucionItem = {
  departamentoId: string;
  asientosReservados: number;
  fraccionVacios: Prisma.Decimal;
  totalAsientos: Prisma.Decimal;
};

export type CalcDistribucionResult = {
  viajeId: string;
  /** true when the records already existed — no recalculation was performed. */
  cached: boolean;
  capacidad: number;
  totalOcupados: number;
  totalVacios: number;
  cantidadDeptos: number;
  distribucion: DistribucionItem[];
};

export type ResumenMensualItem = {
  departamentoId: string;
  departamento: string;
  totalAsientos: Prisma.Decimal;
  cantidadViajes: number;
};

export type LiquidacionDetalleItem = {
  id: string;
  departamentoId: string;
  departamento: string;
  emailContacto: string | null;
  asientosReservados: number;
  fraccionVacios: Prisma.Decimal;
  totalAsientos: Prisma.Decimal;
};

// =============================================================================
// Pure calculation — exported for unit testing (no DB dependency)
// =============================================================================

/**
 * Computes the equal-split seat distribution for a trip.
 *
 * This function is pure: given capacity and per-department counts, it returns
 * the distribution records. No database access. Safe to test in isolation.
 *
 * @param capacity    Total boat capacity for this trip.
 * @param seatsByDept Per-department reservation counts (count must be > 0).
 */
export function computeDistribucion(
  capacity: number,
  seatsByDept: { departamentoId: string; count: number }[],
): DistribucionItem[] {
  if (seatsByDept.length === 0) return [];

  const totalOcupados = seatsByDept.reduce((sum, d) => sum + d.count, 0);
  const totalVacios = Math.max(0, capacity - totalOcupados);
  const cantidadDeptos = seatsByDept.length;

  // Equal split: every department absorbs the same fraction of vacant seats.
  const fraccionBase = new Prisma.Decimal(totalVacios)
    .div(new Prisma.Decimal(cantidadDeptos))
    .toDecimalPlaces(4);

  return seatsByDept.map((dept) => ({
    departamentoId: dept.departamentoId,
    asientosReservados: dept.count,
    fraccionVacios: fraccionBase,
    totalAsientos: new Prisma.Decimal(dept.count)
      .add(fraccionBase)
      .toDecimalPlaces(4),
  }));
}

// =============================================================================
// Statuses that count as "occupied" for liquidation
// =============================================================================

const ACTIVE_STATUSES: ReservationStatus[] = [
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
];

// =============================================================================
// 1. calcularDistribucionViaje
// =============================================================================

/**
 * Computes and persists the seat distribution for a completed trip.
 *
 * Steps:
 *   1. Fetch trip — must exist and have viajeStatus = PASADO.
 *   2. If liquidacionCalculada = true, return cached records (idempotent).
 *   3. Fetch active reservations grouped by departamentoId.
 *   4. Compute equal-split distribution via computeDistribucion().
 *   5. Persist AsientoLiquidacion records + mark trip as calculated
 *      inside a single transaction.
 *   6. Write a LIQUIDACION_CALCULADA audit record (non-blocking).
 *
 * Throws:
 *   TRIP_NOT_FOUND   (404) — trip does not exist
 *   VALIDATION_ERROR (422) — trip is not in PASADO state
 */
export async function calcularDistribucionViaje(
  viajeId: string,
  actorId?: string,
): Promise<CalcDistribucionResult> {
  // ── 1. Fetch trip ──────────────────────────────────────────────────────────
  const viaje = await prisma.trip.findUnique({
    where: { id: viajeId },
    select: {
      id:                   true,
      companyId:            true,
      branchId:             true,
      capacity:             true,
      viajeStatus:          true,
      liquidacionCalculada: true,
      departureTime:        true,
    },
  });

  if (!viaje) {
    throw new AppError("TRIP_NOT_FOUND", "Viaje no encontrado.", 404);
  }

  if (viaje.viajeStatus !== "PASADO") {
    throw new AppError(
      "VIAJE_NO_PASADO",
      `El viaje debe tener estado PASADO para liquidar. Estado actual: ${viaje.viajeStatus}.`,
      422,
    );
  }

  // ── 2. Idempotent: return cached if already calculated ─────────────────────
  if (viaje.liquidacionCalculada) {
    const existing = await getLiquidacionesPorViaje(viajeId);
    const totalOcupados = existing.reduce((s, r) => s + r.asientosReservados, 0);
    return {
      viajeId,
      cached:        true,
      capacidad:     viaje.capacity,
      totalOcupados,
      totalVacios:   Math.max(0, viaje.capacity - totalOcupados),
      cantidadDeptos: existing.length,
      distribucion:  existing.map((r) => ({
        departamentoId:     r.departamentoId,
        asientosReservados: r.asientosReservados,
        fraccionVacios:     r.fraccionVacios,
        totalAsientos:      r.totalAsientos,
      })),
    };
  }

  // ── 3. Fetch active reservations scoped to this company+trip ───────────────
  // Only Reservation records with departamentoId set are counted.
  // Reservations without a departamentoId are excluded from liquidation.
  const rawReservations = await prisma.reservation.findMany({
    where: {
      tripId:        viajeId,
      companyId:     viaje.companyId,
      departamentoId: { not: null },
      status:        { in: ACTIVE_STATUSES },
    },
    select: { departamentoId: true },
  });

  // Group by departamentoId — produces the per-dept count map.
  const countByDept = new Map<string, number>();
  for (const r of rawReservations) {
    if (!r.departamentoId) continue; // narrow nullable type
    countByDept.set(
      r.departamentoId,
      (countByDept.get(r.departamentoId) ?? 0) + 1,
    );
  }

  const seatsByDept = Array.from(countByDept.entries()).map(
    ([departamentoId, count]) => ({ departamentoId, count }),
  );

  // ── 4. Compute distribution ────────────────────────────────────────────────
  const distribucion = computeDistribucion(viaje.capacity, seatsByDept);
  const totalOcupados = seatsByDept.reduce((s, d) => s + d.count, 0);
  const totalVacios   = Math.max(0, viaje.capacity - totalOcupados);
  const mes  = viaje.departureTime.getUTCMonth() + 1;
  const anio = viaje.departureTime.getUTCFullYear();

  // ── 5. Persist atomically ─────────────────────────────────────────────────
  // The transaction ensures either all AsientoLiquidacion records are created
  // AND the trip is marked, or nothing is written.
  await prisma.$transaction(async (tx) => {
    for (const item of distribucion) {
      await tx.asientoLiquidacion.upsert({
        where: {
          viajeId_departamentoId: { viajeId, departamentoId: item.departamentoId },
        },
        // update:{} preserves idempotency: if a partial run already wrote
        // some records, re-entering the transaction won't overwrite them.
        update: {},
        create: {
          companyId:          viaje.companyId,
          branchId:           viaje.branchId,
          viajeId,
          departamentoId:     item.departamentoId,
          asientosReservados: item.asientosReservados,
          fraccionVacios:     item.fraccionVacios,
          totalAsientos:      item.totalAsientos,
          mes,
          anio,
        },
      });
    }

    await tx.trip.update({
      where: { id: viajeId },
      data:  { liquidacionCalculada: true },
    });
  });

  // ── 6. Audit — fire-and-forget; never blocks the primary operation ─────────
  logAction({
    companyId:  viaje.companyId,
    actorId,
    action:     "LIQUIDACION_CALCULADA",
    entityType: "Trip",
    entityId:   viajeId,
    payload:    { mes, anio, cantidadDeptos: distribucion.length, totalOcupados, totalVacios },
  }).catch((err: unknown) => {
    console.error("[liquidacion] audit log failed:", err);
  });

  return {
    viajeId,
    cached:        false,
    capacidad:     viaje.capacity,
    totalOcupados,
    totalVacios,
    cantidadDeptos: distribucion.length,
    distribucion,
  };
}

// =============================================================================
// 2. getResumenMensual
// =============================================================================

/**
 * Returns the monthly liquidation summary grouped by department.
 *
 * @param mes            Calendar month (1–12).
 * @param anio           Calendar year (e.g. 2026).
 * @param departamentoId Optional filter — when provided, returns only that dept.
 *
 * Returns array ordered by totalAsientos DESC.
 */
export async function getResumenMensual(
  mes: number,
  anio: number,
  departamentoId?: string,
): Promise<ResumenMensualItem[]> {
  const grouped = await prisma.asientoLiquidacion.groupBy({
    by:    ["departamentoId"],
    where: {
      mes,
      anio,
      ...(departamentoId ? { departamentoId } : {}),
    },
    _sum:   { totalAsientos: true },
    _count: { viajeId: true },
    orderBy: { _sum: { totalAsientos: "desc" } },
  });

  if (grouped.length === 0) return [];

  // Batch-fetch department names to avoid N+1 queries.
  const deptIds = grouped.map((g) => g.departamentoId);
  const depts = await prisma.department.findMany({
    where:  { id: { in: deptIds } },
    select: { id: true, name: true },
  });
  const deptMap = new Map(depts.map((d) => [d.id, d.name]));

  return grouped.map((g) => ({
    departamentoId: g.departamentoId,
    departamento:   deptMap.get(g.departamentoId) ?? "(desconocido)",
    totalAsientos:  g._sum.totalAsientos ?? new Prisma.Decimal(0),
    cantidadViajes: g._count.viajeId,
  }));
}

// =============================================================================
// 3. getLiquidacionesPorViaje
// =============================================================================

/**
 * Returns the full distribution detail for a specific trip.
 * Returns an empty array if no liquidacion records exist yet.
 */
export async function getLiquidacionesPorViaje(
  viajeId: string,
): Promise<LiquidacionDetalleItem[]> {
  const records = await prisma.asientoLiquidacion.findMany({
    where:   { viajeId },
    include: {
      departamento: {
        select: { name: true, emailContacto: true },
      },
    },
    orderBy: { totalAsientos: "desc" },
  });

  return records.map((r) => ({
    id:                 r.id,
    departamentoId:     r.departamentoId,
    departamento:       r.departamento.name,
    emailContacto:      r.departamento.emailContacto,
    asientosReservados: r.asientosReservados,
    fraccionVacios:     r.fraccionVacios,
    totalAsientos:      r.totalAsientos,
  }));
}
