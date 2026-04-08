// UABL metrics service.
// Computes seat distribution per department per trip.
// Used for the metrics tab and payment allocation calculations.

import { prisma } from "@/lib/prisma";

export type DepartmentBreakdown = {
  departmentId:   string;
  departmentName: string;
  confirmed:      number;
  pending:        number;
  rejected:       number;
  cancelled:      number;
  total:          number;
};

export type TripMetrics = {
  tripId:              string;
  totalCapacity:       number;
  slotsOccupied:       number;  // PENDING + CONFIRMED
  departmentBreakdown: DepartmentBreakdown[];
};

/**
 * Returns seat distribution by department for a specific trip.
 * Used by UABL to understand occupancy and allocate payment.
 */
export async function getTripMetrics(
  tripId: string,
  companyId: string,
): Promise<TripMetrics> {
  const trip = await prisma.trip.findUnique({
    where:  { id: tripId, companyId },
    select: { capacity: true },
  });
  if (!trip) {
    return { tripId, totalCapacity: 0, slotsOccupied: 0, departmentBreakdown: [] };
  }

  type RawRow = {
    departmentId:   string;
    departmentName: string;
    confirmed:      bigint;
    pending:        bigint;
    rejected:       bigint;
    cancelled:      bigint;
  };

  const rows = await prisma.$queryRaw<RawRow[]>`
    SELECT
      ps."departmentId",
      d.name AS "departmentName",
      COUNT(*) FILTER (WHERE ps.status = 'CONFIRMED') AS confirmed,
      COUNT(*) FILTER (WHERE ps.status = 'PENDING')   AS pending,
      COUNT(*) FILTER (WHERE ps.status = 'REJECTED')  AS rejected,
      COUNT(*) FILTER (WHERE ps.status = 'CANCELLED') AS cancelled
    FROM "PassengerSlot" ps
    JOIN "Department" d ON d.id = ps."departmentId"
    WHERE ps."tripId"    = ${tripId}
      AND ps."companyId" = ${companyId}
    GROUP BY ps."departmentId", d.name
    ORDER BY d.name ASC
  `;

  const breakdown: DepartmentBreakdown[] = rows.map((r) => ({
    departmentId:   r.departmentId,
    departmentName: r.departmentName,
    confirmed:  Number(r.confirmed),
    pending:    Number(r.pending),
    rejected:   Number(r.rejected),
    cancelled:  Number(r.cancelled),
    total:      Number(r.confirmed) + Number(r.pending),
  }));

  const slotsOccupied = breakdown.reduce((sum, d) => sum + d.confirmed + d.pending, 0);

  return { tripId, totalCapacity: trip.capacity, slotsOccupied, departmentBreakdown: breakdown };
}

export type BranchMetricsSummary = {
  tripId:        string;
  departureTime: Date;
  boatName:      string;
  totalCapacity: number;
  slotsOccupied: number;
  departmentBreakdown: DepartmentBreakdown[];
};

/**
 * Returns metrics for all trips in a branch within a date range.
 * Used for the UABL metrics tab with filters.
 */
export async function getBranchMetrics(
  companyId: string,
  branchId:  string,
  dateFrom:  Date,
  dateTo:    Date,
): Promise<BranchMetricsSummary[]> {
  const trips = await prisma.trip.findMany({
    where: {
      companyId,
      branchId,
      departureTime: { gte: dateFrom, lte: dateTo },
    },
    select: {
      id:            true,
      departureTime: true,
      capacity:      true,
      boat:          { select: { name: true } },
    },
    orderBy: { departureTime: "asc" },
  });

  return Promise.all(
    trips.map(async (trip) => {
      const m = await getTripMetrics(trip.id, companyId);
      return {
        tripId:              trip.id,
        departureTime:       trip.departureTime,
        boatName:            trip.boat.name,
        totalCapacity:       m.totalCapacity,
        slotsOccupied:       m.slotsOccupied,
        departmentBreakdown: m.departmentBreakdown,
      };
    }),
  );
}
