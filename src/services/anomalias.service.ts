// =============================================================================
// Anomaly Detection Service
// =============================================================================
//
// Detects operational anomalies in real time for a given company.
// All queries are batched (no N+1). All times use Argentina UTC-3.
//
// Anomaly types:
//   VIAJE_BAJA_OCUPACION_INMINENTE — trip departing in <2h with <30% occupancy
//   VIAJE_SIN_PASAJEROS            — today's completed trip with 0 confirmed seats
//   DEPT_ALTA_CANCELACION          — department with 3+ slot cancellations in 7 days
//   LANCHA_BAJA_OCUPACION          — boat averaging <40% occupancy in last 30 days
// =============================================================================

import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SeveridadAnomalia = "critica" | "alta" | "media";

export type Anomalia = {
  id:          string;
  tipo:        string;
  severidad:   SeveridadAnomalia;
  titulo:      string;
  descripcion: string;
  accion:      string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** UTC timestamps for "right now" and "start of today" in Argentina (UTC-3). */
function argTime(): { now: Date; todayStart: Date } {
  const now = new Date();
  const shifted = new Date(now.getTime() - 3 * 60 * 60 * 1000); // UTC-3 offset
  const todayStart = new Date(
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate(),
      3, 0, 0, 0,           // 00:00 ART = 03:00 UTC
    ),
  );
  return { now, todayStart };
}

const ARG_TZ = "America/Argentina/Buenos_Aires";

function horaArg(date: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    hour:     "2-digit",
    minute:   "2-digit",
    timeZone: ARG_TZ,
  }).format(date);
}

const SEVERITY_ORDER: Record<SeveridadAnomalia, number> = {
  critica: 0,
  alta:    1,
  media:   2,
};

// ---------------------------------------------------------------------------
// detectarAnomalias
// ---------------------------------------------------------------------------

export async function detectarAnomalias(companyId: string): Promise<Anomalia[]> {
  const anomalias: Anomalia[] = [];
  const { now, todayStart } = argTime();

  // ── 1. Viajes con salida en ≤ 2 h y ocupación < 30 % ─────────────────────
  {
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    const trips = await prisma.trip.findMany({
      where: {
        companyId,
        departureTime: { gte: now, lte: twoHoursLater },
        viajeStatus:   "ACTIVO",
        status:        { notIn: ["CANCELLED", "DEPARTED", "COMPLETED"] },
      },
      select: {
        id:            true,
        capacity:      true,
        departureTime: true,
        boat:          { select: { name: true } },
      },
    });

    if (trips.length > 0) {
      const ids = trips.map((t) => t.id);
      const slotGroups = await prisma.passengerSlot.groupBy({
        by:    ["tripId"],
        where: { companyId, tripId: { in: ids }, status: { in: ["PENDING", "CONFIRMED"] } },
        _count: { id: true },
      });
      const slotMap = new Map(slotGroups.map((g) => [g.tripId, g._count.id]));

      for (const trip of trips) {
        const occupied = slotMap.get(trip.id) ?? 0;
        const ratio    = trip.capacity > 0 ? occupied / trip.capacity : 0;

        if (ratio < 0.30) {
          const minutos = Math.round((trip.departureTime.getTime() - now.getTime()) / 60_000);
          const pct     = (ratio * 100).toFixed(0);
          anomalias.push({
            id:          `viaje_bajo_${trip.id}`,
            tipo:        "VIAJE_BAJA_OCUPACION_INMINENTE",
            severidad:   "critica",
            titulo:      `${trip.boat.name} sale en ${minutos} min — ${pct}% ocupación`,
            descripcion: `Solo ${occupied} de ${trip.capacity} asientos cubiertos (${pct}%) con ${minutos} minutos para la salida.`,
            accion:      "Evaluá cancelar o reagrupar pasajeros de otro viaje antes de la partida.",
          });
        }
      }
    }
  }

  // ── 2. Viajes de hoy ya completados con 0 pasajeros confirmados ───────────
  {
    const tripsHoy = await prisma.trip.findMany({
      where: {
        companyId,
        departureTime: { gte: todayStart, lt: now },
        viajeStatus:   "PASADO",
        status:        { notIn: ["CANCELLED"] },
      },
      select: {
        id:            true,
        capacity:      true,
        departureTime: true,
        boat:          { select: { name: true } },
      },
    });

    if (tripsHoy.length > 0) {
      const ids = tripsHoy.map((t) => t.id);
      const confirmedGroups = await prisma.passengerSlot.groupBy({
        by:    ["tripId"],
        where: { companyId, tripId: { in: ids }, status: "CONFIRMED" },
        _count: { id: true },
      });
      const confirmedMap = new Map(confirmedGroups.map((g) => [g.tripId, g._count.id]));

      for (const trip of tripsHoy) {
        if ((confirmedMap.get(trip.id) ?? 0) === 0) {
          const hora = horaArg(trip.departureTime);
          anomalias.push({
            id:          `viaje_vacio_${trip.id}`,
            tipo:        "VIAJE_SIN_PASAJEROS",
            severidad:   "alta",
            titulo:      `Viaje de las ${hora} completado sin pasajeros`,
            descripcion: `${trip.boat.name} operó el viaje de las ${hora} de hoy sin ningún pasajero confirmado (${trip.capacity} asientos sin usar).`,
            accion:      "Verificá si el viaje debió cancelarse o si hubo un problema en el registro de pasajeros.",
          });
        }
      }
    }
  }

  // ── 3. Departamentos con ≥ 3 cancelaciones en los últimos 7 días ──────────
  {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const cancelGroups = await prisma.passengerSlot.groupBy({
      by:    ["departmentId"],
      where: { companyId, status: "CANCELLED", updatedAt: { gte: sevenDaysAgo } },
      _count: { id: true },
      having: { id: { _count: { gte: 3 } } },
    });

    if (cancelGroups.length > 0) {
      const deptIds = cancelGroups.map((g) => g.departmentId);
      const depts   = await prisma.department.findMany({
        where:  { id: { in: deptIds } },
        select: { id: true, name: true },
      });
      const nameById = new Map(depts.map((d) => [d.id, d.name]));

      for (const row of cancelGroups) {
        const nombre = nameById.get(row.departmentId) ?? "Departamento desconocido";
        anomalias.push({
          id:          `dept_cancelaciones_${row.departmentId}`,
          tipo:        "DEPT_ALTA_CANCELACION",
          severidad:   "media",
          titulo:      `${nombre}: ${row._count.id} cancelaciones en 7 días`,
          descripcion: `El departamento acumuló ${row._count.id} slots cancelados en la última semana, inusualmente alto.`,
          accion:      "Contactá al responsable del departamento para identificar la causa.",
        });
      }
    }
  }

  // ── 4. Lanchas con ocupación promedio < 40 % en los últimos 30 días ───────
  {
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const trips30 = await prisma.trip.findMany({
      where: {
        companyId,
        departureTime: { gte: thirtyDaysAgo, lt: now },
        viajeStatus:   { not: "CANCELADO" },
      },
      select: {
        id:       true,
        capacity: true,
        boatId:   true,
        boat:     { select: { name: true } },
      },
    });

    if (trips30.length > 0) {
      const ids = trips30.map((t) => t.id);
      const slotGroups = await prisma.passengerSlot.groupBy({
        by:    ["tripId"],
        where: { companyId, tripId: { in: ids }, status: { in: ["PENDING", "CONFIRMED"] } },
        _count: { id: true },
      });
      const slotMap = new Map(slotGroups.map((g) => [g.tripId, g._count.id]));

      // Aggregate per boat
      const boatMap = new Map<string, { name: string; occupancySum: number; count: number }>();
      for (const trip of trips30) {
        const occupied = slotMap.get(trip.id) ?? 0;
        const ratio    = trip.capacity > 0 ? occupied / trip.capacity : 0;
        const entry    = boatMap.get(trip.boatId) ?? { name: trip.boat.name, occupancySum: 0, count: 0 };
        entry.occupancySum += ratio;
        entry.count        += 1;
        boatMap.set(trip.boatId, entry);
      }

      for (const [boatId, b] of boatMap) {
        const avg = b.count > 0 ? b.occupancySum / b.count : 0;
        if (avg < 0.40) {
          const pct = (avg * 100).toFixed(0);
          anomalias.push({
            id:          `lancha_baja_${boatId}`,
            tipo:        "LANCHA_BAJA_OCUPACION",
            severidad:   "alta",
            titulo:      `${b.name}: ${pct}% promedio en 30 días`,
            descripcion: `${b.count} viaje${b.count !== 1 ? "s" : ""} operado${b.count !== 1 ? "s" : ""} con ocupación promedio del ${pct}%, por debajo del umbral del 40%.`,
            accion:      "Evaluá consolidar viajes o revisar la asignación de esta embarcación.",
          });
        }
      }
    }
  }

  // Sort: critica → alta → media
  anomalias.sort((a, b) => SEVERITY_ORDER[a.severidad] - SEVERITY_ORDER[b.severidad]);

  return anomalias;
}
