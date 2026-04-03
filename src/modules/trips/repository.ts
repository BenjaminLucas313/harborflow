// Trip repository: all Prisma queries for Trip. No business logic.

import { Prisma, TripStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Shared select — used by every query in this file for a consistent return shape.
// Includes boat name and driver name so callers never need a second query.
// ---------------------------------------------------------------------------

const TRIP_SELECT = {
  id: true,
  companyId: true,
  branchId: true,
  boatId: true,
  driverId: true,
  departureTime: true,
  estimatedArrivalTime: true,
  status: true,
  capacity: true,
  waitlistEnabled: true,
  statusReason: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  boat: { select: { id: true, name: true } },
  driver: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.TripSelect;

export type TripRow = Prisma.TripGetPayload<{ select: typeof TRIP_SELECT }>;

// ---------------------------------------------------------------------------
// Statuses considered "active" for passenger-facing listings by default.
// CANCELLED, DEPARTED, COMPLETED are terminal and hidden unless explicitly requested.
// ---------------------------------------------------------------------------

const NON_TERMINAL_STATUSES: TripStatus[] = [
  TripStatus.SCHEDULED,
  TripStatus.BOARDING,
  TripStatus.DELAYED,
];

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

export type CreateTripData = {
  companyId: string;
  branchId: string;
  boatId: string;
  driverId?: string;
  departureTime: Date;
  estimatedArrivalTime?: Date;
  /** Snapshotted from boat.capacity by the service — never from the client. */
  capacity: number;
  waitlistEnabled: boolean;
  notes?: string;
};

export async function createTrip(data: CreateTripData): Promise<TripRow> {
  return prisma.trip.create({
    data: {
      companyId: data.companyId,
      branchId: data.branchId,
      boatId: data.boatId,
      driverId: data.driverId,
      departureTime: data.departureTime,
      estimatedArrivalTime: data.estimatedArrivalTime,
      capacity: data.capacity,
      waitlistEnabled: data.waitlistEnabled,
      notes: data.notes,
    },
    select: TRIP_SELECT,
  });
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export type ListTripsFilter = {
  branchId: string;
  /** If set, filters to trips whose departureTime falls within [dayStart, dayEnd). */
  dayStart?: Date;
  dayEnd?: Date;
  /** If omitted, defaults to NON_TERMINAL_STATUSES. */
  status?: TripStatus;
};

export async function listTripsByBranch(
  filter: ListTripsFilter,
): Promise<TripRow[]> {
  return prisma.trip.findMany({
    where: {
      branchId: filter.branchId,
      ...(filter.dayStart && filter.dayEnd
        ? { departureTime: { gte: filter.dayStart, lt: filter.dayEnd } }
        : {}),
      status: filter.status ? filter.status : { in: NON_TERMINAL_STATUSES },
    },
    select: TRIP_SELECT,
    orderBy: { departureTime: "asc" },
  });
}

/** Tenant-scoped single-trip lookup. Returns null if not found or wrong company. */
export async function findTripById(
  id: string,
  companyId: string,
): Promise<TripRow | null> {
  return prisma.trip.findFirst({
    where: { id, companyId },
    select: TRIP_SELECT,
  });
}
