// Prisma queries for TripAllocation and SeatRequest.
// No business logic here — only data access.
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Select shapes
// ---------------------------------------------------------------------------

export const SEAT_REQUEST_SELECT = {
  id: true,
  allocationId: true,
  employeeId: true,
  workTypeId: true,
  departmentId: true,
  status: true,
  confirmedById: true,
  confirmedAt: true,
  rejectionNote: true,
  notifiedAt: true,
  createdAt: true,
  updatedAt: true,
  employee: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  workType: {
    select: { id: true, name: true, departmentId: true },
  },
  department: {
    select: { id: true, name: true },
  },
  confirmedBy: {
    select: { id: true, firstName: true, lastName: true },
  },
} as const;

export const ALLOCATION_SELECT = {
  id: true,
  companyId: true,
  tripId: true,
  requestedById: true,
  status: true,
  submittedAt: true,
  createdAt: true,
  updatedAt: true,
  trip: {
    select: {
      id: true,
      departureTime: true,
      estimatedArrivalTime: true,
      status: true,
      capacity: true,
      boat: { select: { id: true, name: true, capacity: true } },
      driver: { select: { id: true, firstName: true, lastName: true } },
    },
  },
  requestedBy: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  seatRequests: { select: SEAT_REQUEST_SELECT },
} as const;

export type SeatRequestRow = Awaited<
  ReturnType<typeof findSeatRequestById>
>;
export type AllocationRow = Awaited<
  ReturnType<typeof findAllocationById>
>;

// ---------------------------------------------------------------------------
// Allocation reads
// ---------------------------------------------------------------------------

export async function findAllocationById(id: string) {
  return prisma.tripAllocation.findUnique({
    where: { id },
    select: ALLOCATION_SELECT,
  });
}

export async function listAllocationsByCompany(companyId: string) {
  return prisma.tripAllocation.findMany({
    where: { companyId },
    select: ALLOCATION_SELECT,
    orderBy: { createdAt: "desc" },
  });
}

export async function listAllocationsByTrip(tripId: string) {
  return prisma.tripAllocation.findMany({
    where: { tripId },
    select: ALLOCATION_SELECT,
    orderBy: { createdAt: "asc" },
  });
}

// ---------------------------------------------------------------------------
// SeatRequest reads
// ---------------------------------------------------------------------------

export async function findSeatRequestById(id: string) {
  return prisma.seatRequest.findUnique({
    where: { id },
    select: SEAT_REQUEST_SELECT,
  });
}

export async function listSeatRequestsByEmployee(employeeId: string) {
  return prisma.seatRequest.findMany({
    where: {
      employeeId,
      status: { in: ["PENDING", "CONFIRMED"] },
    },
    select: {
      ...SEAT_REQUEST_SELECT,
      allocation: {
        select: {
          id: true,
          companyId: true,
          status: true,
          trip: {
            select: {
              id: true,
              departureTime: true,
              estimatedArrivalTime: true,
              status: true,
              boat: { select: { id: true, name: true } },
            },
          },
          requestedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function listSeatRequestsByDepartmentAndTrip(
  departmentId: string,
  tripId: string,
) {
  return prisma.seatRequest.findMany({
    where: {
      departmentId,
      allocation: { tripId },
    },
    select: SEAT_REQUEST_SELECT,
    orderBy: { createdAt: "asc" },
  });
}

/** Count active (PENDING + CONFIRMED) seats for a trip across all allocations. */
export async function countActiveSeatsForTrip(
  tripId: string,
  tx?: typeof prisma,
): Promise<number> {
  const client = tx ?? prisma;
  const result = await client.seatRequest.count({
    where: {
      status: { in: ["PENDING", "CONFIRMED"] },
      allocation: { tripId },
    },
  });
  return result;
}

/** Check if an employee already has an active seat on a given trip. */
export async function employeeHasActiveSeatOnTrip(
  employeeId: string,
  tripId: string,
): Promise<boolean> {
  const count = await prisma.seatRequest.count({
    where: {
      employeeId,
      status: { in: ["PENDING", "CONFIRMED"] },
      allocation: { tripId },
    },
  });
  return count > 0;
}
